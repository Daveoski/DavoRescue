"use client";

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useLayoutEffect } from "react";

import { cn } from "@/shared/lib/cn";
import { useHydrated } from "@/shared/lib/use-hydrated";

import { useTheme } from "./store";
import { applyTheme, readThemePreference, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Re-applies the saved theme after hydration. In development React's Strict
 * Mode remount strips the attribute the <head> script set; in production this
 * is a no-op.
 */
function useReapplyTheme() {
  useLayoutEffect(() => {
    applyTheme(readThemePreference());
  }, []);
}

/** Compact dropdown for the header. */
export function ThemeMenu() {
  useReapplyTheme();
  const hydrated = useHydrated();
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);
  const current = OPTIONS.find((o) => o.value === (hydrated ? preference : "system"))!;

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm btn-square"
        aria-label={`Theme: ${current.label}. Change theme`}
        title="Change theme"
      >
        <current.Icon className="size-4" aria-hidden />
      </div>
      <ul tabIndex={0} className="menu dropdown-content z-[700] mt-2 w-40 rounded-box border border-base-300 bg-base-100 p-1.5 shadow-lg">
        {OPTIONS.map(({ value, label, Icon }) => (
          <li key={value}>
            <button
              type="button"
              className={cn("justify-between", preference === value && hydrated && "menu-active")}
              onClick={() => {
                setPreference(value);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4" aria-hidden /> {label}
              </span>
              {preference === value && hydrated && <Check className="size-3.5" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Three-way switch for the mobile menu and footer. */
export function ThemeSwitch({ className }: { className?: string }) {
  useReapplyTheme();
  const hydrated = useHydrated();
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("join", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = hydrated && preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={cn("btn btn-sm join-item gap-1.5", active ? "btn-secondary" : "btn-ghost border-base-300")}
          >
            <Icon className="size-3.5" aria-hidden /> {label}
          </button>
        );
      })}
    </div>
  );
}
