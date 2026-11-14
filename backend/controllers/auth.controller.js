import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";
import {
  storeRefreshToken,
  validateRefreshToken,
  deleteRefreshToken,
  blacklistToken,
  isTokenBlacklisted,
} from "../config/redis.js";

// ── Consistent response helpers ───────────────────────────────────────────────
const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, ...data });

const fail = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

// ── Build the safe user payload (never include password) ──────────────────────
const userPayload = (user) => ({
  _id:              user.id,       // keep _id alias for frontend compatibility
  id:               user.id,
  name:             user.name,
  email:            user.email,
  role:             user.role,
  isVerified:       user.isVerified,
  subscriptionType: user.subscriptionType,
});

// ── REGISTER ──────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Body: { name, email, password }
// Returns: { success, user, accessToken, refreshToken }
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check duplicate email
    const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return fail(res, "An account with this email already exists.", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password: hashedPassword,
    });

    const accessToken  = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token in Redis
    await storeRefreshToken(user.id, refreshToken);

    return ok(res, {
      user:         userPayload(user),
      accessToken,
      refreshToken,
      // Legacy field kept for older frontend code
      token:        accessToken,
      _id:          user.id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
    }, 201);
  } catch (error) {
    console.error("[register]", error.message);
    return fail(res, error.message, 500);
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// Returns: { success, user, accessToken, refreshToken }
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return fail(res, "Invalid email or password.", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return fail(res, "Invalid email or password.", 401);
    }

    const accessToken  = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token in Redis (replaces any previous one)
    await storeRefreshToken(user.id, refreshToken);

    return ok(res, {
      user:         userPayload(user),
      accessToken,
      refreshToken,
      // Legacy fields
      token:        accessToken,
      _id:          user.id,
      name:         user.name,
      email:        user.email,
      role:         user.role,
    });
  } catch (error) {
    console.error("[login]", error.message);
    return fail(res, error.message, 500);
  }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────
// POST /api/auth/refresh-token
// Body: { refreshToken }
// Returns: { success, accessToken, refreshToken }
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return fail(res, "Refresh token is required.", 401);
    }

    const JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "dev_refresh_secret";

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      return fail(res, "Invalid or expired refresh token.", 401);
    }

    // Validate against Redis-stored token
    const isValid = await validateRefreshToken(decoded.id, token);
    if (!isValid) {
      return fail(res, "Refresh token reuse detected. Please login again.", 401);
    }

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) {
      return fail(res, "User not found.", 401);
    }

    const newAccessToken  = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    // Rotate: store the new refresh token in Redis
    await storeRefreshToken(user.id, newRefreshToken);

    return ok(res, {
      accessToken:  newAccessToken,
      refreshToken: newRefreshToken,
      token:        newAccessToken, // legacy
    });
  } catch (error) {
    console.error("[refreshToken]", error.message);
    return fail(res, "Token refresh failed.", 401);
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Headers: Authorization: Bearer <accessToken>
// Blacklists the access token & deletes the refresh token from Redis
export const logout = async (req, res) => {
  try {
    // Blacklist the current access token if provided
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await blacklistToken(token);
    }

    // If a refreshToken was sent in the body, delete it from Redis
    const { refreshToken: rt, userId } = req.body || {};
    if (userId) {
      await deleteRefreshToken(userId);
    }

    return ok(res, { message: "Logged out successfully." });
  } catch (error) {
    console.error("[logout]", error.message);
    return ok(res, { message: "Logged out." }); // always succeed
  }
};

// ── GET CURRENT USER ──────────────────────────────────────────────────────────
// GET /api/auth/me  OR  GET /api/users/me
// Headers: Authorization: Bearer <accessToken>
// Returns: { success, user }
export const getMe = async (req, res) => {
  try {
    // req.user is set by protect middleware (already excludes password)
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) {
      return fail(res, "User not found.", 404);
    }
    return ok(res, { user: userPayload(user) });
  } catch (error) {
    console.error("[getMe]", error.message);
    return fail(res, error.message, 500);
  }
};
