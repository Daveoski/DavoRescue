import type { Metadata } from "next";

import { PageIntro } from "@/shared/ui/page-intro";

export const metadata: Metadata = {
  title: "How verification and dispatch work",
  description:
    "How DavoRescue locates, verifies and dispatches emergency reports in Enugu and the South-East — and what happens when a report can't be verified.",
  alternates: { canonical: "/about" },
};

const sections = [
  {
    title: "1. Location",
    body: "Your phone's GPS fix is matched against OpenStreetMap. We record the road name, whether a vehicle can use it, the local government area and the state. If you're on a footpath, a farm track or open ground, we also record the nearest point a vehicle can reach, and responders' directions go there.",
  },
  {
    title: "2. Verification",
    body: "The verification desk reads the report the way a control-room officer would: the words (English, Pidgin or Igbo), the photos, when and where the photos were taken, the time of day, and any other reports nearby in the last hour. It marks the report genuine or not genuine, gives a confidence level, a severity from 1 to 5 and an urgency score, and writes a short message for responders. If the AI service is unavailable, a rule-based check takes over so reports keep flowing.",
  },
  {
    title: "3. Dispatch",
    body: "Genuine reports are sent to the agencies responsible for that state and that kind of emergency — the police control room and the Command & Control Centre for crime, the fire service for fires and explosions, NEMSAS ambulance lines for injuries — by SMS and email, with coordinates and a map link. Signed-in users within their chosen radius get a push alert.",
  },
  {
    title: "4. Reports that aren't verified",
    body: "They are never shown publicly and nobody is alerted. They stay in the responder console, where an officer can overrule the decision — that immediately dispatches the report. A real emergency is never simply deleted.",
  },
];

export default function AboutPage() {
  return (
    <div className="wrap max-w-3xl py-12">
      <PageIntro eyebrow="How it works" title="From your phone to a responder">
        DavoRescue exists so that a report made in a panic on a dark road reaches someone who can act on it, with a location they can
        drive to.
      </PageIntro>
      <div className="mt-12 space-y-10">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-2xl font-extrabold">{s.title}</h2>
            <p className="mt-3 text-base-content/80">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
