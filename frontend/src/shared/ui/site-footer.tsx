import Link from "next/link";

import { site, states } from "@/shared/config/site";
import { ThemeSwitch } from "@/shared/theme/theme-toggle";

import { Logo } from "./logo";

// Evaluated once at build; reading the clock during render would opt every page out of prerendering.
const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-base-300 bg-base-200">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-base-content/70">
            Emergency reporting and response coordination for Enugu and the South-East of Nigeria.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-base-content/55">
            DavoRescue is an independent public-safety service, not a government agency. If you can make a call, dial 112 as well as
            reporting here.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="eyebrow mb-3">Use DavoRescue</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="link link-hover" href="/report">Report an emergency</Link></li>
            <li><Link className="link link-hover" href="/live">Live incident map</Link></li>
            <li><Link className="link link-hover" href="/alerts">Alerts near me</Link></li>
            <li><Link className="link link-hover" href="/download">Android app</Link></li>
            <li><Link className="link link-hover" href="/responder">Responder console</Link></li>
          </ul>
        </nav>
        <nav aria-label="Emergency numbers by state">
          <p className="eyebrow mb-3">Emergency numbers</p>
          <ul className="space-y-2 text-sm">
            {states.map((s) => (
              <li key={s.slug}>
                <Link className="link link-hover" href={`/directory/${s.slug}`}>
                  {s.name} State
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="About">
          <p className="eyebrow mb-3">About</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="link link-hover" href="/safety">Road safety guide</Link></li>
            <li><Link className="link link-hover" href="/about">How verification works</Link></li>
            <li><Link className="link link-hover" href="/privacy">Privacy</Link></li>
            <li><Link className="link link-hover" href="/terms">Terms of use</Link></li>
            <li><a className="link link-hover" href={site.repoUrl} rel="noopener noreferrer">Source code</a></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-base-300">
        <div className="wrap flex flex-wrap items-center justify-between gap-4 py-5">
          <p className="text-xs text-base-content/55">© {YEAR} DavoRescue · Map data © OpenStreetMap contributors · Street photos © Mapillary contributors</p>
          <ThemeSwitch />
        </div>
      </div>
    </footer>
  );
}
