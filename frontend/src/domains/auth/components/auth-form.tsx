"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import agencies from "@/domains/agencies/directory.json";
import { ApiError } from "@/shared/lib/api-client";

import { authApi } from "../api";
import { fieldErrors, signInSchema, signUpSchema, type SignUpValues } from "../schemas";
import { isResponder, useAuth } from "../store";

type Mode = "signin" | "signup";

const blankSignUp: SignUpValues = {
  full_name: "",
  phone: "",
  email: "",
  password: "",
  responder: false,
  invite_code: "",
  agency_slug: "",
};

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [values, setValues] = useState({ identifier: "", ...blankSignUp });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((er) => ({ ...er, [key]: "", form: "" }));
  };

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
        const { responder, invite_code, agency_slug, email, ...rest } = parsed.data;
        session = await authApi.signUp({
          ...rest,
          email: email || null,
          ...(responder ? { invite_code, agency_slug: agency_slug || undefined } : {}),
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

  const field = (
    key: keyof typeof values,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        className={`input input-lg w-full ${errors[key] ? "input-error" : ""}`}
        value={values[key] as string}
        onChange={set(key)}
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
          {field("password", "Password", { type: "password", autoComplete: "current-password" })}
        </>
      ) : (
        <>
          {field("full_name", "Full name", { autoComplete: "name" })}
          {field("phone", "Mobile number", { type: "tel", autoComplete: "tel", placeholder: "0803 123 4567" })}
          {field("email", "Email (optional)", { type: "email", autoComplete: "email" })}
          {field("password", "Password", { type: "password", autoComplete: "new-password" })}

          <label className="flex cursor-pointer items-start gap-3 rounded-box border border-base-300 p-3">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-0.5"
              checked={values.responder}
              onChange={set("responder")}
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
                <select className="select select-lg w-full" value={values.agency_slug} onChange={set("agency_slug")}>
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
            <Link className="link link-primary" href="/signup">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link className="link link-primary" href="/signin">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
