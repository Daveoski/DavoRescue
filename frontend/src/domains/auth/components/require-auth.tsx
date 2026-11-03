"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { withNext } from "../next-path";
import { isResponder, useAuth, useSessionReady } from "../store";

type Props = {
  children: ReactNode;
  responder?: boolean;
  next: string;
  /** Go straight to sign-in instead of showing a sign-in prompt. */
  redirect?: boolean;
};

export function RequireAuth({ children, responder = false, next, redirect = false }: Props) {
  const router = useRouter();
  const ready = useSessionReady();
  const user = useAuth((s) => s.user);
  const sendToSignIn = redirect && ready && !user;

  useEffect(() => {
    if (sendToSignIn) router.replace(withNext("/signin", next));
  }, [sendToSignIn, router, next]);

  if (!ready || sendToSignIn) return <div className="skeleton h-64 w-full" />;

  if (!user) {
    return (
      <div className="max-w-md rounded-box border border-base-300 p-6">
        <h2 className="text-xl font-bold">Sign in to continue</h2>
        <p className="mt-2 text-sm text-base-content/70">
          {responder
            ? "The responder console is for verified police, fire, ambulance and control-room staff."
            : "Create a free account to get alerts about verified incidents near you."}
        </p>
        <div className="mt-5 flex gap-3">
          <Link href={withNext("/signin", next)} className="btn btn-primary">
            Sign in
          </Link>
          <Link href={withNext("/signup", next)} className="btn">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (responder && !isResponder(user)) {
    return (
      <div className="max-w-md rounded-box border border-base-300 p-6">
        <h2 className="text-xl font-bold">Responders only</h2>
        <p className="mt-2 text-sm text-base-content/70">
          Your account isn&apos;t linked to a response agency. Ask your command for a DavoRescue invite code.
        </p>
        <Link href="/alerts" className="btn mt-5">
          Go to my alerts
        </Link>
      </div>
    );
  }

  return children;
}
