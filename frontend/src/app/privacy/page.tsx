import type { Metadata } from "next";

import { PageIntro } from "@/shared/ui/page-intro";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What DavoRescue collects when you report an emergency, who sees it, and how long it is kept.",
  alternates: { canonical: "/privacy" },
};

const items = [
  ["What we collect from a report", "The type of emergency, your description, the location you pinned, its GPS accuracy, and any photos you take. If you add a callback number or are signed in and not anonymous, responders see your name and number."],
  ["What we don't keep", "Your IP address. We store a one-way, salted code derived from it so we can limit spam; it can't be turned back into your address."],
  ["Who sees what", "The public sees verified incidents only: type, severity, road and approximate time — never your description, photos or identity. Responders see the full report, including photos."],
  ["Photos", "Photos are sent to responders and to our AI verification provider (Anthropic) for checking. They are not used to train AI models and are never published."],
  ["Accounts", "If you sign up we store your name, phone number, optional email, a hashed password, your alert radius and your last shared location, which is used only to decide which alerts to send you."],
  ["Your rights", "Under the Nigeria Data Protection Act 2023 you can ask for a copy of your data, or for it to be corrected or deleted, by opening an issue on our GitHub repository."],
];

export default function PrivacyPage() {
  return (
    <div className="wrap max-w-3xl py-12">
      <PageIntro eyebrow="Privacy" title="Your data, plainly" />
      <dl className="mt-10 space-y-8">
        {items.map(([term, desc]) => (
          <div key={term}>
            <dt className="text-xl font-bold">{term}</dt>
            <dd className="mt-2 text-base-content/80">{desc}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
