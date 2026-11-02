import { Phone } from "lucide-react";

import { prettyPhone } from "@/shared/lib/format";

type Entry = { name: string; kind: string; phones: string[] };

/** Big tap targets for calling responders directly — shown on every receipt. */
export function CallList({ entries, title = "Call a responder now" }: { entries: Entry[]; title?: string }) {
  if (!entries.length) return null;
  return (
    <section aria-labelledby="call-list-title">
      <h3 id="call-list-title" className="eyebrow mb-3">
        {title}
      </h3>
      <ul className="divide-y divide-base-300 overflow-hidden rounded-box border border-base-300">
        {entries.map((entry) => (
          <li key={entry.name} className="flex flex-wrap items-center justify-between gap-2 bg-base-100 px-4 py-3">
            <span className="font-medium">{entry.name}</span>
            <span className="flex flex-wrap gap-2">
              {entry.phones.slice(0, 2).map((phone) => (
                <a key={phone} href={`tel:${phone}`} className="btn btn-sm btn-primary gap-1.5 font-mono tabular">
                  <Phone className="size-3.5" aria-hidden />
                  {prettyPhone(phone)}
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
