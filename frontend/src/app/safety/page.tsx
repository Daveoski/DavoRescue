import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/shared/ui/json-ld";
import { PageIntro } from "@/shared/ui/page-intro";

export const metadata: Metadata = {
  title: "Road safety in Enugu & the South-East — what to do in an emergency",
  description:
    "Practical steps for robbery, kidnapping attempts, gunfire, explosions, fires and crashes on South-East Nigerian roads, and what to tell responders.",
  alternates: { canonical: "/safety" },
};

const guides = [
  {
    id: "robbery",
    title: "If you're caught in a robbery",
    points: [
      "Comply. No phone, car or money is worth your life.",
      "Avoid eye contact and sudden movements; keep your hands visible.",
      "Once they've gone and you're safe, report it — note the number of attackers, vehicles and direction they left in.",
    ],
  },
  {
    id: "kidnapping",
    title: "If you witness a kidnapping",
    points: [
      "Do not follow or confront the attackers.",
      "From a safe distance, note the vehicle colour, type and plate, and which way it went.",
      "Report immediately — speed matters most in the first minutes. Then call 112.",
    ],
  },
  {
    id: "gunfire",
    title: "If you hear gunfire",
    points: [
      "Get low and get behind something solid — a wall or an engine block, not a car door.",
      "If you're driving towards it, turn around when it's safe to do so.",
      "Stay put until it has stopped for some time, then report where you heard it from.",
    ],
  },
  {
    id: "explosion",
    title: "After an explosion",
    points: [
      "Move away and upwind — there may be a second blast, fire or gas.",
      "Don't use naked flames, and don't go back for belongings.",
      "Report it with a photo only if you are already a safe distance away.",
    ],
  },
  {
    id: "fire",
    title: "Fires — markets, filling stations, tankers",
    points: [
      "Keep well clear of fallen or burning tankers. Never scoop fuel.",
      "Keep the road open so fire trucks can get through.",
      "Report the nearest junction or landmark as well as your pin — it helps crews approach.",
    ],
  },
  {
    id: "crash",
    title: "At a road crash",
    points: [
      "Park well clear, hazards on, and warn traffic behind you.",
      "Don't move injured people unless there's a fire or other immediate danger.",
      "Report how many people are hurt and whether anyone is trapped. FRSC: 122.",
    ],
  },
];

export default function SafetyPage() {
  return (
    <div className="wrap py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "What to do in an emergency on South-East Nigerian roads",
          inLanguage: "en-NG",
          about: guides.map((g) => g.title),
        }}
      />
      <PageIntro eyebrow="Road safety" title="What to do when things go wrong on the road">
        Short, practical guidance for the situations people report most. Your safety comes first — report only when you&apos;re out of
        danger.
      </PageIntro>

      <nav aria-label="Guides" className="mt-8 flex flex-wrap gap-2">
        {guides.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="btn btn-sm">
            {g.title.replace(/^(If you're caught in |If you witness |If you hear |After |At )/, "")}
          </a>
        ))}
      </nav>

      <div className="mt-12 grid gap-x-12 gap-y-14 md:grid-cols-2">
        {guides.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`}>
            <h2 id={`${g.id}-title`} className="text-2xl font-extrabold">
              {g.title}
            </h2>
            <ul className="mt-4 space-y-3">
              {g.points.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="text-base-content/80">{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-16 rounded-box bg-neutral p-8 text-neutral-content">
        <h2 className="text-2xl font-extrabold">When you&apos;re safe, report it.</h2>
        <p className="mt-2 opacity-80">Your report warns everyone heading that way and puts responders on the exact spot.</p>
        <Link href="/report" className="btn btn-primary mt-6">
          Report an emergency
        </Link>
      </section>
    </div>
  );
}
