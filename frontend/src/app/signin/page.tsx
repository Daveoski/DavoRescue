import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInWithNext } from "@/domains/auth/components/sign-in-with-next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to DavoRescue to get alerts near you or open the responder console.",
  alternates: { canonical: "/signin" },
};

export default function SignInPage() {
  return (
    <div className="wrap max-w-md py-14">
      <h1 className="text-4xl font-extrabold">Sign in</h1>
      <p className="mt-2 mb-8 text-base-content/70">Get alerts near you, or open the responder console.</p>
      <Suspense fallback={<div className="skeleton h-72 w-full" />}>
        <SignInWithNext />
      </Suspense>
    </div>
  );
}
