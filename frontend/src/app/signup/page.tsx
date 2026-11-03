import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFormWithNext } from "@/domains/auth/components/auth-form-with-next";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Sign up free to get alerts about verified emergencies near you in Enugu and the South-East.",
  alternates: { canonical: "/signup" },
};

export default function SignUpPage() {
  return (
    <div className="wrap max-w-md py-14">
      <h1 className="text-4xl font-extrabold">Create an account</h1>
      <p className="mt-2 mb-8 text-base-content/70">
        Free. Get alerted when a verified robbery, kidnapping, fire or crash is reported near you.
      </p>
      <Suspense fallback={<div className="skeleton h-96 w-full" />}>
        <AuthFormWithNext mode="signup" />
      </Suspense>
    </div>
  );
}
