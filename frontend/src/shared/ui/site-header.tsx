"use client";

import { LogOut, Menu, Siren, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

import { isResponder, useAuth, useSessionReady } from "@/domains/auth/store";
import { cn } from "@/shared/lib/cn";
import { ThemeMenu, ThemeSwitch } from "@/shared/theme/theme-toggle";

import { Logo } from "./logo";

const nav = [
  { href: "/live", label: "Live map" },
  { href: "/directory", label: "Emergency numbers" },
  { href: "/safety", label: "Road safety" },
  { href: "/download", label: "Get the app" },
];

function DesktopNav({ pathname }: { pathname: string | null }) {
  return (
    <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname?.startsWith(item.href) ? "page" : undefined}
          className={cn(
            "rounded-field px-3 py-2 text-sm font-medium transition-colors hover:bg-base-200",
            pathname?.startsWith(item.href) ? "text-base-content" : "text-base-content/70",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// The current URL is request data; reading it inside Suspense keeps the header in the static shell.
function ActiveDesktopNav() {
  return <DesktopNav pathname={usePathname()} />;
}

export function SiteHeader() {
  const ready = useSessionReady();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const [open, setOpen] = useState(false);

  const account = ready && user;
  const home = account ? (isResponder(user) ? { href: "/responder", label: "Console" } : { href: "/alerts", label: "My alerts" }) : null;

  return (
    <header className="sticky top-0 z-[600] border-b border-base-300 bg-base-100/90 backdrop-blur supports-[backdrop-filter]:bg-base-100/80">
      <div className="wrap flex h-16 items-center gap-6">
        <Link href="/" className="shrink-0" aria-label="DavoRescue home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <Suspense fallback={<DesktopNav pathname={null} />}>
          <ActiveDesktopNav />
        </Suspense>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex">
            <ThemeMenu />
          </span>
          {home ? (
            <>
              <Link href={home.href} className="btn btn-ghost btn-sm hidden sm:inline-flex">
                {home.label}
              </Link>
              <button type="button" className="btn btn-ghost btn-sm btn-square hidden sm:inline-flex" onClick={signOut} aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <Link href="/signin" className={cn("btn btn-ghost btn-sm hidden sm:inline-flex", !ready && "invisible")}>
              Sign in
            </Link>
          )}
          <Link href="/report" className="btn btn-primary btn-sm gap-1.5 sm:btn-md">
            <Siren className="size-4" aria-hidden />
            Report
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-base-300 md:hidden" aria-label="Mobile">
          <ul className="wrap divide-y divide-base-300 py-2">
            {[...nav, ...(home ? [home] : [{ href: "/signin", label: "Sign in" }])].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block py-3 text-base font-medium" onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
            {account && (
              <li>
                <button
                  type="button"
                  className="block w-full py-3 text-left text-base font-medium text-base-content/70"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </li>
            )}
            <li className="flex items-center justify-between gap-3 py-3">
              <span className="text-base font-medium">Theme</span>
              <ThemeSwitch />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
