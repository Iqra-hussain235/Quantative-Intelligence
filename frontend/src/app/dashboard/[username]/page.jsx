/**
 * /dashboard/[username]  -- Dynamic personalized dashboard route
 *
 * After login the user is redirected to /dashboard/<their-name-slug>
 * (e.g. /dashboard/john-doe). This page renders the same Dashboard
 * while showing the user name in the URL.
 */
"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import DashboardPage from "../page";

export default function UserDashboard() {
  const { username } = useParams();
  const router = useRouter();

  const isAuthenticated = useSelector((s) => s?.auth?.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  return <DashboardPage />;
}