"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import agencies from "@/domains/agencies/directory.json";
import { ApiError } from "@/shared/lib/api-client";
import { cn } from "@/shared/lib/cn";

import { authApi } from "../api";
import { withNext } from "../next-path";
import { checkPassword, passwordStrength } from "../password";
import { fieldErrors, signInSchema, signUpSchema, type SignUpValues } from "../schemas";
import { isResponder, useAuth } from "../store";
import { PasswordField, PasswordRules } from "./password-field";

export type Mode = "signin" | "signup";
type Values = SignUpValues & { identifier: string };

const blank: Values = {
  identifier: "",
  full_name: "",
  phone: "",
  email: "",
  password: "",
  confirm_password: "",
  responder: false,
  invite_code: "",
  agency_slug: "",
};

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [values, setValues] = useState<Values>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const update = (key: keyof Values, value: string | boolean) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((er) => ({ ...er, [key]: "", form: "" }));
  };

  const checks = checkPassword(values.password, { name: values.full_name, phone: values.phone });
  const strength = passwordStrength(checks, values.password);
  const confirmState = !values.confirm_password ? null : values.confirm_password === values.password ? "match" : "mismatch";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    try {
      setPending(true);
      let session;
      if (mode === "signin") {
        const parsed = signInSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        session = await authApi.signIn(parsed.data);
      } else {
        const parsed = signUpSchema.safeParse(values);
        if (!parsed.success) return setErrors(fieldErrors(parsed.error));
        // The confirmation only exists in the browser; the API receives the password once.
        const d = parsed.data;
        session = await authApi.signUp({
          full_name: d.full_name,
          phone: d.phone,
          password: d.password,
          email: d.email || null,
          ...(d.responder ? { invite_code: d.invite_code, agency_slug: d.agency_slug || undefined } : {}),
        });
      }
      setSession(session.token, session.user);
      router.replace(next ?? (isResponder(session.user) ? "/responder" : "/alerts"));
    } catch (err) {
      const apiErr = err as ApiError;
      setErrors({ [apiErr.field ?? "form"]: apiErr.message });
    } finally {
      setPending(false);
    }
  }

  const field = (key: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        className={cn("input input-lg w-full", errors[key] && "input-error")}
        value={values[key] as string}
        onChange={(e) => update(key, e.target.value)}
        aria-invalid={Boolean(errors[key])}
        {...props}
      />
      {errors[key] && <span className="mt-1 block text-sm text-error">{errors[key]}</span>}
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {mode === "signin" ? (
        <>
          {field("identifier", "Phone number or email", { autoComplete: "username", inputMode: "email" })}
          <PasswordField
            label="Password"
            value={values.password}
            onChange={(v) => update("password", v)}
            error={errors.password}
            autoComplete="current-password"
          />
        </>
      ) : (
        <>
          {field("full_name", "Full name", { autoComplete: "name" })}
          {field("phone", "Mobile number", { type: "tel", autoComplete: "tel", placeholder: "0803 123 4567" })}
          {field("email", "Email (optional)", { type: "email", autoComplete: "email" })}

          <div>
            <PasswordField
              label="Create a password"
              value={values.password}
              onChange={(v) => update("password", v)}
              error={errors.password}
              autoComplete="new-password"
              describedBy="password-rules"
            />
            <PasswordRules id="password-rules" checks={checks} strength={strength} />
          </div>

          <div>
            <PasswordField
              label="Confirm password"
              value={values.confirm_password}
              onChange={(v) => update("confirm_password", v)}
              error={errors.confirm_password}
              autoComplete="new-password"
              describedBy="confirm-state"
            />
            {confirmState && !errors.confirm_password && (
              <p
                id="confirm-state"
                aria-live="polite"
                className={cn("mt-1 flex items-center gap-1.5 text-xs", confirmState === "match" ? "text-success" : "text-warning")}
              >
                {confirmState === "match" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                {confirmState === "match" ? "Passwords match" : "Doesn’t match yet"}
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-box border border-base-300 p-3">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-0.5"
              checked={values.responder}
              onChange={(e) => update("responder", e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium">I&apos;m a responder</span>
              <span className="block text-base-content/65">Police, fire, ambulance or control-room staff with an invite code.</span>
            </span>
          </label>

          {values.responder && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("invite_code", "Invite code", { autoComplete: "off" })}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Agency</span>
                <select className="select select-lg w-full" value={values.agency_slug} onChange={(e) => update("agency_slug", e.target.value)}>
                  <option value="">Select your agency</option>
                  {agencies.agencies.map((a) => (
                    <option key={a.slug} value={a.slug}>
                      {a.short_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </>
      )}

      {errors.form && (
        <p role="alert" className="rounded-field bg-error/10 px-3 py-2 text-sm text-error">
          {errors.form}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
        {pending && <span className="loading loading-spinner loading-sm" />}
        {mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-sm text-base-content/70">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <Link className="link link-primary" href={withNext("/signup", next)}>
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link className="link link-primary" href={withNext("/signin", next)}>
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
