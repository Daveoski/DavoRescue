import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgencyCard } from "@/domains/agencies/components/agency-card";
import { checkedOn, nationalAgencies, stateAgencies } from "@/domains/agencies/data";
import { site, states } from "@/shared/config/site";
import { JsonLd } from "@/shared/ui/json-ld";
import { PageIntro } from "@/shared/ui/page-intro";

export function generateStaticParams() {
  return states.map((s) => ({ state: s.slug }));
}

function find(slug: string) {
  return states.find((s) => s.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/directory/[state]">): Promise<Metadata> {
  const state = find((await params).state);
  if (!state) return {};
  return {
    title: `${state.name} emergency numbers — police, fire, ambulance`,
    description: `Official emergency phone numbers for ${state.name} State: police control room, fire service, ambulance and 112. Tap to call, or report an emergency with your exact location.`,
    alternates: { canonical: `/directory/${state.slug}` },
  };
}

export default async function StateDirectoryPage({ params }: PageProps<"/directory/[state]">) {
  const state = find((await params).state);
  if (!state) notFound();

  const local = stateAgencies(state.slug);
  const checked = new Date(checkedOn).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="wrap space-y-12 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${state.name} State emergency numbers`,
          itemListElement: local.map((a, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": a.kind === "police" ? "PoliceStation" : a.kind === "fire" ? "FireStation" : "EmergencyService",
              name: a.name,
              telephone: a.phones,
              ...(a.emails.length ? { email: a.emails[0] } : {}),
              areaServed: { "@type": "State", name: `${state.name} State` },
              url: `${site.url}/directory/${state.slug}`,
            },
          })),
        }}
      />
      <PageIntro eyebrow={`${state.name} State · checked ${checked}`} title={`${state.name} emergency numbers`}>
        Police, fire, ambulance and command-centre lines for {state.name}. Tap a number to call. To send responders your exact
        location, <Link href="/report" className="link link-primary">report the emergency</Link> instead — it takes under a minute.
      </PageIntro>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {local.map((a) => (
          <AgencyCard key={a.slug} agency={a} />
        ))}
      </div>

      <section>
        <h2 className="mb-4 text-2xl font-extrabold">Also works in {state.name}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nationalAgencies.map((a) => (
            <AgencyCard key={a.slug} agency={a} />
          ))}
        </div>
      </section>

      <nav aria-label="Other states" className="flex flex-wrap gap-2">
        {states
          .filter((s) => s.slug !== state.slug)
          .map((s) => (
            <Link key={s.slug} href={`/directory/${s.slug}`} className="btn btn-sm">
              {s.name} numbers
            </Link>
          ))}
      </nav>
    </div>
  );
}
