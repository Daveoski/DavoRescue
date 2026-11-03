"use client";

import { useSearchParams } from "next/navigation";

import { safeNext } from "../next-path";
import { AuthForm, type Mode } from "./auth-form";

// Why we're asking, for pages that send people here to sign in first.
const reasons: Record<string, string> = {
  "/trip": "Sign in to use Trip guardian. Your contacts are told who is travelling, so we need to know it’s you.",
  "/alerts": "Sign in to get alerts about verified incidents near you.",
};

export function AuthFormWithNext({ mode }: { mode: Mode }) {
  const next = safeNext(useSearchParams().get("next"));
  const reason = next && reasons[next];
  return (
    <>
      {reason && <p className="mb-6 rounded-box border border-secondary/40 bg-secondary/10 p-4 text-sm">{reason}</p>}
      <AuthForm mode={mode} next={next} />
    </>
  );
}
