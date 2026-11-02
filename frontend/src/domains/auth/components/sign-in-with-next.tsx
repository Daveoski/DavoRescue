"use client";

import { useSearchParams } from "next/navigation";

import { AuthForm } from "./auth-form";

export function SignInWithNext() {
  const next = useSearchParams().get("next");
  // Only follow same-site paths, never an absolute URL from the query string.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return <AuthForm mode="signin" next={safeNext} />;
}
