import { Download, ShieldCheck, Smartphone } from "lucide-react";
import type { Metadata } from "next";

import { site } from "@/shared/config/site";
import { PageIntro } from "@/shared/ui/page-intro";

export const metadata: Metadata = {
  title: "Download the DavoRescue Android app",
  description:
    "Install the DavoRescue Android app to report emergencies in Enugu and the South-East with your camera and GPS ready in one tap.",
  alternates: { canonical: "/download" },
};

const steps = [
  "Tap “Download for Android” below. Your phone saves DavoRescue.apk.",
  "Open the file from your notifications or the Downloads folder.",
  "If Android asks, allow your browser to install apps (Settings → Install unknown apps).",
  "Tap Install, then open DavoRescue and allow camera and location when asked.",
];

export default function DownloadPage() {
  return (
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-8">
        <PageIntro eyebrow="Android · free" title="DavoRescue for Android">
          Opens straight to the report screen with your camera and GPS ready. Works on Android 7 and newer.
        </PageIntro>
        <a href={site.apkUrl} className="btn btn-primary btn-lg gap-2">
          <Download className="size-5" /> Download for Android
        </a>
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary font-mono text-sm text-secondary-content">
                {i + 1}
              </span>
              <span className="pt-1">{s}</span>
            </li>
          ))}
        </ol>
        <p className="flex items-start gap-2 text-sm text-base-content/65">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          The app is built automatically from the public source code on GitHub and signed with the same key on every release, so
          updates install over the old version.
        </p>
      </div>

      <aside className="h-fit rounded-box border border-base-300 p-6">
        <Smartphone className="size-7 text-primary" />
        <h2 className="mt-4 text-2xl font-bold">iPhone, or prefer not to install?</h2>
        <p className="mt-2 text-base-content/70">Add the website to your home screen — it works like an app:</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <strong>Android (Chrome):</strong> menu ⋮ → <em>Add to Home screen</em>
          </li>
          <li>
            <strong>iPhone (Safari):</strong> Share → <em>Add to Home Screen</em>
          </li>
        </ul>
      </aside>
    </div>
  );
}
