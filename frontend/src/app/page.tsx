import { ArrowRight, BadgeCheck, Camera, EyeOff, MapPinned, Phone, Radio, Route, Smartphone } from "lucide-react";
import Link from "next/link";

import { agencies, primaryLine } from "@/domains/agencies/data";
import { incidentTypes } from "@/domains/incidents/catalogue";
import { site, states } from "@/shared/config/site";
import { prettyPhone } from "@/shared/lib/format";
import { JsonLd } from "@/shared/ui/json-ld";

const faqs = [
  {
    q: "Do I need an account to report an emergency?",
    a: "No. Anyone can report anonymously in a few taps. An account is only needed if you want alerts about verified incidents near you, or want responders to be able to call you back.",
  },
  {
    q: "How does DavoRescue know a report is genuine?",
    a: "Each report is checked against its photos, the exact location, the time and other reports nearby. The verification desk marks it genuine or not genuine and explains why. Genuine reports go to responders straight away; the rest are held for a responder to review, so a real emergency is never silently dropped.",
  },
  {
    q: "Which emergency numbers does it use?",
    a: "Published numbers from the Enugu State Police Command, the Enugu State Command & Control Centre (112), the Enugu State Fire Service, NEMSAS ambulance lines and the police commands of Anambra, Abia, Ebonyi and Imo. Each listing shows its official source and the date we last checked it.",
  },
  {
    q: "What if the incident isn't on a proper road?",
    a: "Drop the pin anywhere — a footpath, a farm track or open bush. We record the exact GPS point, tell responders the spot isn't motorable, and give them the nearest point a vehicle can reach.",
  },
  {
    q: "Is there a mobile app?",
    a: "Yes. Download the Android app from the Get the app page, or install this website to your home screen. Both use your phone's camera and GPS.",
  },
];

const steps = [
  {
    Icon: MapPinned,
    title: "Pinned to the exact road",
    body: "Your GPS fix is matched to the road network. Responders see the road name, whether it's motorable, and the nearest vehicle access if you're on a footpath or in the bush.",
  },
  {
    Icon: BadgeCheck,
    title: "Checked before anyone is paged",
    body: "Photos from the in-app camera are stamped with time and position. The verification desk weighs them with your words and nearby reports, then marks the report genuine or not.",
  },
  {
    Icon: Radio,
    title: "Sent to the people responsible",
    body: "Genuine reports go to the police, fire or ambulance service for that state with the coordinates attached, and everyone signed up nearby gets an alert to stay clear.",
  },
];

const enuguLines = agencies.filter((a) => a.state === "enugu").slice(0, 4);

function MapSketch() {
  return (
    <svg viewBox="0 0 520 440" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <g fill="none" strokeLinecap="round" className="stroke-base-content/15">
        <path d="M-10 300 C 120 280, 180 210, 300 200 S 470 150, 540 90" strokeWidth="14" />
        <path d="M60 -10 C 90 120, 140 220, 150 450" strokeWidth="9" />
        <path d="M260 450 C 280 360, 330 300, 420 270 S 520 240, 540 250" strokeWidth="9" />
        <path d="M150 230 C 210 260, 240 330, 300 360" strokeWidth="5" strokeDasharray="2 10" />
        <path d="M340 205 C 360 150, 400 110, 470 40" strokeWidth="5" />
      </g>
      <g className="fill-base-content/45 font-mono" fontSize="11">
        <text x="330" y="186">ENUGU–ONITSHA EXPY</text>
        <text x="20" y="80" transform="rotate(72 20 80)">NINTH MILE RD</text>
        <text x="380" y="300">AGBANI RD</text>
        <text x="214" y="330">footpath</text>
      </g>
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }}
      />

      <section className="relative overflow-hidden border-b border-base-300">
        <div className="wrap grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="eyebrow">Enugu · Anambra · Abia · Ebonyi · Imo</p>
            <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[0.98] sm:text-6xl lg:text-[4.2rem]">
              Report it once.
              <br />
              <span className="text-primary">The right responders</span> know where.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-base-content/75">
              Robbery, kidnapping, gunshots, a blast, a fire, a crash, someone collapsed by the roadside — DavoRescue pins it to the
              exact stretch of road, checks it, and sends it to the police, fire or ambulance service responsible for that spot.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/report" className="btn btn-primary btn-lg">
                Report an emergency <ArrowRight className="size-5" />
              </Link>
              <Link href="/live" className="btn btn-lg">
                See what&apos;s happening now
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-base-content/60">
              <EyeOff className="size-4" /> No account needed. Report anonymously.
            </p>
          </div>

          <div className="relative min-h-[420px]">
            <div className="grid-paper absolute inset-0 rounded-box border border-base-300 bg-base-200">
              <MapSketch />
            </div>
            <div className="absolute left-[54%] top-[44%]" aria-hidden>
              <span className="pulse-ring absolute -inset-3 rounded-full bg-primary/40" />
              <span className="relative block size-4 rounded-full border-2 border-white bg-primary" />
            </div>
            <figure className="relative mx-auto mt-16 w-[88%] max-w-sm rounded-box border border-base-300 bg-base-100 shadow-[0_18px_50px_-20px_rgb(0_0_0/0.35)] sm:mt-20 lg:ml-[6%]">
              <div className="flex items-center justify-between border-b border-dashed border-base-300 px-4 py-2.5 font-mono text-[11px] text-base-content/60">
                <span>EXAMPLE DISPATCH</span>
                <span>21:14 WAT</span>
              </div>
              <div className="space-y-3 p-4">
                <p className="flex items-center gap-2">
                  <span className="badge badge-sm badge-error font-mono">SEV 5</span>
                  <span className="font-display text-lg font-bold">Kidnapping in progress</span>
                </p>
                <p className="text-sm leading-relaxed text-base-content/80">
                  Four armed men forced a passenger into a grey Sienna at Ugwu Onyeama, heading towards Ninth Mile.
                </p>
                <p className="font-mono text-[11px] leading-relaxed text-base-content/60">
                  Enugu–Onitsha Expressway, Udi
                  <br />
                  6.43751°N 7.43260°E ±9 m · motorable
                </p>
                <div className="flex flex-wrap gap-1.5 border-t border-base-300 pt-3 text-xs">
                  <span className="badge badge-success badge-soft badge-sm gap-1">
                    <BadgeCheck className="size-3" /> Verified
                  </span>
                  <span className="badge badge-ghost badge-sm">2 live photos</span>
                  <span className="badge badge-ghost badge-sm">1 report nearby</span>
                </div>
              </div>
            </figure>
          </div>
        </div>
      </section>

      <section className="wrap py-20" aria-labelledby="how">
        <div className="max-w-2xl">
          <p className="eyebrow">What happens when you press send</p>
          <h2 id="how" className="mt-3 text-4xl font-extrabold sm:text-5xl">
            Location, verification, dispatch — in one report.
          </h2>
        </div>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-box border border-base-300 bg-base-300 md:grid-cols-3">
          {steps.map(({ Icon, title, body }, i) => (
            <li key={title} className="bg-base-100 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <Icon className="size-7 text-primary" aria-hidden />
                <span className="font-mono text-sm text-base-content/40">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-2xl font-bold">{title}</h3>
              <p className="mt-3 text-base-content/70">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-base-300 bg-base-200" aria-labelledby="what">
        <div className="wrap py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="eyebrow">What you can report</p>
              <h2 id="what" className="mt-3 text-4xl font-extrabold sm:text-5xl">
                Crime, fire and medical emergencies.
              </h2>
            </div>
            <Link href="/report" className="btn btn-secondary">
              Start a report
            </Link>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {incidentTypes.map(({ id, label, hint, Icon }) => (
              <li key={id} className="rounded-box border border-base-300 bg-base-100 p-5">
                <Icon className="size-6 text-primary" aria-hidden />
                <p className="mt-4 font-display text-xl font-bold">{label}</p>
                <p className="mt-1 text-sm text-base-content/65">{hint}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="wrap grid gap-12 py-20 lg:grid-cols-2" aria-labelledby="evidence">
        <div>
          <p className="eyebrow">Built for the roadside</p>
          <h2 id="evidence" className="mt-3 text-4xl font-extrabold sm:text-5xl">
            Evidence responders can trust.
          </h2>
          <ul className="mt-8 space-y-6">
            <li className="flex gap-4">
              <Camera className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-bold">In-app camera with a time and GPS stamp</p>
                <p className="text-base-content/70">
                  Photos are taken live and stamped on the spot, so a picture from last year&apos;s news can&apos;t pass as tonight&apos;s.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <Route className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-bold">Motorable roads and the paths in between</p>
                <p className="text-base-content/70">
                  Expressways, estate roads, footpaths and farm tracks. If a van can&apos;t get there, responders are told where it
                  can.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <EyeOff className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-bold">Anonymous by default</p>
                <p className="text-base-content/70">
                  No sign-in, no name. We don&apos;t store your IP address — only a one-way code used to stop spam.
                </p>
              </div>
            </li>
          </ul>
        </div>

        <div className="rounded-box border border-base-300 p-6 sm:p-8" aria-labelledby="hotlines">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="hotlines" className="text-2xl font-bold">
              Enugu emergency lines
            </h2>
            <Link href="/directory/enugu" className="link text-sm">
              All numbers
            </Link>
          </div>
          <ul className="mt-6 divide-y divide-base-300">
            {enuguLines.map((a) => (
              <li key={a.slug} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm font-medium">{a.short_name}</span>
                <a href={`tel:${primaryLine(a)}`} className="btn btn-sm gap-1.5 font-mono tabular">
                  <Phone className="size-3.5" aria-hidden /> {prettyPhone(primaryLine(a))}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-base-content/60">Other states:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {states
              .filter((s) => s.slug !== "enugu")
              .map((s) => (
                <Link key={s.slug} href={`/directory/${s.slug}`} className="btn btn-sm btn-ghost border-base-300">
                  {s.name}
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary text-secondary-content" aria-labelledby="app">
        <div className="wrap grid items-center gap-10 py-16 md:grid-cols-[1fr_auto]">
          <div className="max-w-xl">
            <p className="font-mono text-xs uppercase tracking-[0.14em] opacity-60">Android app</p>
            <h2 id="app" className="mt-3 text-4xl font-extrabold">
              Keep it one tap away.
            </h2>
            <p className="mt-4 opacity-80">
              The DavoRescue app opens straight to the report screen, with your camera and GPS ready. Free, and small enough for any
              phone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={site.apkUrl} className="btn btn-primary btn-lg gap-2">
                <Smartphone className="size-5" /> Download for Android
              </a>
              <Link href="/download" className="btn btn-lg btn-ghost border-current/25 text-current">
                Install instructions
              </Link>
            </div>
          </div>
          <div className="mx-auto hidden h-72 w-40 rounded-[2rem] border-4 border-current/25 p-2 md:block" aria-hidden>
            <div className="flex h-full flex-col justify-end gap-2 rounded-[1.5rem] bg-base-100 p-3 text-base-content">
              <div className="h-24 rounded-lg bg-base-200" />
              <div className="h-3 w-3/4 rounded bg-base-300" />
              <div className="h-3 w-1/2 rounded bg-base-300" />
              <div className="mt-2 rounded-lg bg-primary py-2 text-center text-[10px] font-bold text-primary-content">SEND REPORT</div>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap py-20" aria-labelledby="faq">
        <h2 id="faq" className="text-4xl font-extrabold">
          Questions
        </h2>
        <div className="mt-8 divide-y divide-base-300 border-y border-base-300">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {f.q}
                <span className="font-mono text-base-content/40 transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-3xl text-base-content/75">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
