"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The multi-step onboarding wizard has been replaced by the simplified
// business setup + immediate upload flow at /businesses/new.
export default function OnboardingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/businesses/new");
  }, [router]);
  return null;
}
