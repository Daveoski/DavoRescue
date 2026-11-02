import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";

import { prettyPhone } from "@/shared/lib/format";

import { kindLabel, type Agency } from "../data";

export function AgencyCard({ agency }: { agency: Agency }) {
  return (
    <article
      className="flex h-full flex-col rounded-box border border-base-300 bg-base-100 p-5"
      itemScope
      itemType="https://schema.org/EmergencyService"
    >
      <p className="eyebrow">{kindLabel[agency.kind]}</p>
      <h3 className="mt-1 text-lg font-bold leading-snug" itemProp="name">
        {agency.name}
      </h3>
      {agency.address && (
        <p className="mt-2 flex gap-2 text-sm text-base-content/70" itemProp="address">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          {agency.address}
        </p>
      )}

      <ul className="mt-4 flex flex-wrap gap-2">
        {agency.phones.map((phone) => (
          <li key={phone}>
            <a
              href={`tel:${phone}`}
              className="btn btn-sm gap-1.5 font-mono tabular"
              itemProp="telephone"
              content={phone}
              aria-label={`Call ${agency.short_name} on ${phone}`}
            >
              <Phone className="size-3.5" aria-hidden />
              {prettyPhone(phone)}
            </a>
          </li>
        ))}
      </ul>

      {agency.emails.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {agency.emails.map((email) => (
            <li key={email}>
              <a href={`mailto:${email}`} className="link link-hover inline-flex items-center gap-1.5" itemProp="email">
                <Mail className="size-3.5" aria-hidden />
                {email}
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-4 text-xs leading-relaxed text-base-content/55">
        {agency.source_note}{" "}
        <a href={agency.source_url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-0.5">
          Source <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </article>
  );
}
