"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/shared/lib/cn";

import type { PasswordCheck, Strength } from "../password";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
};

/** Password input with a show/hide toggle. */
export function PasswordField({ label, value, onChange, error, autoComplete, describedBy }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className={cn("input input-lg w-full pr-1", error && "input-error")}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="grow"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="btn btn-ghost btn-sm btn-square"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <span className="mt-1 block text-sm text-error">{error}</span>}
    </div>
  );
}

const meterTone = ["", "bg-error", "bg-warning", "bg-success", "bg-success"];

/** Live rule checklist and strength meter shown under a new password. */
export function PasswordRules({ id, checks, strength }: { id: string; checks: PasswordCheck[]; strength: Strength }) {
  return (
    <div id={id} className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={cn("h-1.5 rounded-full", step <= strength.score ? meterTone[strength.score] : "bg-base-300")} />
          ))}
        </div>
        <span className="w-24 text-right text-xs font-medium">{strength.label}</span>
      </div>
      <ul className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.id} className={cn("flex items-center gap-1.5", c.ok ? "text-success" : "text-base-content/60")}>
            {c.ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <X className="size-3.5 shrink-0" aria-hidden />}
            <span>
              {c.label}
              <span className="sr-only">{c.ok ? " — done" : " — not yet"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
