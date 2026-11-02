import type { Metadata } from "next";

import { PageIntro } from "@/shared/ui/page-intro";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using DavoRescue to report and follow emergencies.",
  alternates: { canonical: "/terms" },
};

const terms = [
  "DavoRescue is an independent service. It is not the police, the fire service or an ambulance service, and cannot guarantee that any agency will respond. In a life-threatening emergency, call 112 as well.",
  "Report only what you believe to be true. Knowingly making a false report wastes responders' time, may put others in danger and can be a criminal offence.",
  "Never put yourself at risk to take a photo or make a report.",
  "Public incident information is provided to help people stay safe and may be incomplete or out of date.",
  "We may suspend accounts or block reporters who misuse the service.",
];

export default function TermsPage() {
  return (
    <div className="wrap max-w-3xl py-12">
      <PageIntro eyebrow="Terms" title="Terms of use" />
      <ol className="mt-10 list-decimal space-y-4 pl-5 text-base-content/80 marker:font-mono marker:text-base-content/50">
        {terms.map((t) => (
          <li key={t} className="pl-2">
            {t}
          </li>
        ))}
      </ol>
    </div>
  );
}
