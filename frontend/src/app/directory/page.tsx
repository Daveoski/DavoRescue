import type { Metadata } from "next";
import Link from "next/link";

import { AgencyCard } from "@/domains/agencies/components/agency-card";
import { checkedOn, nationalAgencies, stateAgencies } from "@/domains/agencies/data";
import { states } from "@/shared/config/site";
import { PageIntro } from "@/shared/ui/page-intro";

export const metadata: Metadata = {
  title: "Emergency numbers for Enugu & the South-East",
  description:
    "Police control rooms, fire service, ambulance (NEMSAS) and command-centre numbers for Enugu, Anambra, Abia, Ebonyi and Imo — each with its official source.",
  alternates: { canonical: "/directory" },
};

const checked = new Date(checkedOn).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

export default function DirectoryPage() {
  return (
    <div className="wrap space-y-14 py-12">
      <PageIntro eyebrow={`Last checked ${checked}`} title="Emergency numbers">
        Every number here comes from an official release, linked under each listing. If a line doesn&apos;t connect, dial{" "}
        <a href="tel:112" className="link font-mono font-semibold">
          112
        </a>{" "}
        — it&apos;s free and works on every network.
      </PageIntro>

      {states.map((s) => (
        <section key={s.slug} aria-labelledby={`state-${s.slug}`}>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id={`state-${s.slug}`} className="text-3xl font-extrabold">
              {s.name}
            </h2>
            <Link href={`/directory/${s.slug}`} className="link text-sm">
              {s.name} page
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stateAgencies(s.slug).map((a) => (
              <AgencyCard key={a.slug} agency={a} />
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="national">
        <h2 id="national" className="mb-4 text-3xl font-extrabold">
          National lines
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nationalAgencies.map((a) => (
            <AgencyCard key={a.slug} agency={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
