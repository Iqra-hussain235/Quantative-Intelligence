/**
 * config/redis.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton ioredis client with:
 *  - Graceful no-op fallback when Redis is unavailable or REDIS_ENABLED=false
 *  - Token blacklist helpers (for logout / token revocation)
 *  - Refresh-token store helpers (server-side refresh token validation)
 */

import Redis from "ioredis";

// ── Feature flag ──────────────────────────────────────────────────────────────
const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// ── No-op client (used when Redis is disabled / unavailable) ─────────────────
const noopClient = {
  set:    async () => "OK",
  get:    async () => null,
  del:    async () => 0,
  exists: async () => 0,
  expire: async () => 1,
  setex:  async () => "OK",
  ping:   async () => "PONG",
  status: "noop",
};

let redisClient = noopClient;

// ── Connect to Redis ──────────────────────────────────────────────────────────
if (REDIS_ENABLED) {
  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout:       3000,
      lazyConnect:          true,
      enableOfflineQueue:   false,
      retryStrategy:        () => null, // don't auto-reconnect — use noop fallback instead
    });

    client.on("connect", () =>
      console.log("[Redis] ✅ Connected to", REDIS_URL)
    );
    client.on("error", (err) => {
      // Downgrade to noop on connection error — app keeps working without Redis
      if (redisClient !== noopClient) {
        console.warn("[Redis] ⚠️  Connection error (using noop fallback):", err.message);
        redisClient = noopClient;
      }
    });

    // Try once; if it fails we fall through to noopClient
    await client.connect().catch((err) => {
      console.warn("[Redis] ⚠️  Could not connect (using noop fallback):", err.message);
    });

    if (client.status === "ready") {
      redisClient = client;
    }
  } catch (err) {
    console.warn("[Redis] ⚠️  Failed to initialize (using noop fallback):", err.message);
  }
} else {
  console.log("[Redis] ℹ️  Disabled via REDIS_ENABLED=false — using noop fallback.");
}

export default redisClient;

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

// JWT access token TTL (15 min default → stored in seconds for Redis)
const ACCESS_TTL_S = () => {
  const raw = process.env.JWT_EXPIRATION || "15m";
  if (raw.endsWith("m")) return parseInt(raw) * 60;
  if (raw.endsWith("h")) return parseInt(raw) * 3600;
  if (raw.endsWith("d")) return parseInt(raw) * 86400;
  return 900; // 15 min fallback
};

// Refresh token TTL (7d default)
const REFRESH_TTL_S = () => {
  const raw = process.env.JWT_REFRESH_EXPIRATION || "7d";
  if (raw.endsWith("d")) return parseInt(raw) * 86400;
  if (raw.endsWith("h")) return parseInt(raw) * 3600;
  return 604800; // 7d fallback
};

// ── Blacklist an access token (on logout) ────────────────────────────────────
export const blacklistToken = async (token) => {
  try {
    const key = `bl:${token}`;
    await redisClient.setex(key, ACCESS_TTL_S(), "1");
  } catch (err) {
    console.warn("[Redis] blacklistToken error:", err.message);
  }
};

// ── Check if an access token has been blacklisted ────────────────────────────
export const isTokenBlacklisted = async (token) => {
  try {
    const val = await redisClient.get(`bl:${token}`);
    return val === "1";
  } catch (_) {
    return false; // fail open — don't block users if Redis is down
  }
};

// ── Store refresh token server-side ──────────────────────────────────────────
export const storeRefreshToken = async (userId, refreshToken) => {
  try {
    const key = `rt:${userId}`;
    await redisClient.setex(key, REFRESH_TTL_S(), refreshToken);
  } catch (err) {
    console.warn("[Redis] storeRefreshToken error:", err.message);
  }
};

// ── Validate refresh token against Redis store ───────────────────────────────
export const validateRefreshToken = async (userId, refreshToken) => {
  try {
    const stored = await redisClient.get(`rt:${userId}`);
    return stored === refreshToken;
  } catch (_) {
    return true; // fail open when Redis is down
  }
};

// ── Delete refresh token (on logout) ─────────────────────────────────────────
export const deleteRefreshToken = async (userId) => {
  try {
    await redisClient.del(`rt:${userId}`);
  } catch (err) {
    console.warn("[Redis] deleteRefreshToken error:", err.message);
  }
};
