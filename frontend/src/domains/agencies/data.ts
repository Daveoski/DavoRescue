import directory from "./directory.json";

export type AgencyKind = "police" | "fire" | "ambulance" | "frsc" | "nema" | "security" | "hotline";

export type Agency = {
  slug: string;
  name: string;
  short_name: string;
  kind: AgencyKind;
  categories: string[];
  state: string;
  phones: string[];
  sms_phones: string[];
  emails: string[];
  address: string | null;
  source_url: string;
  source_note: string;
  priority: number;
};

export const checkedOn = directory.checked_on;
export const agencies = directory.agencies as Agency[];

export const kindLabel: Record<AgencyKind, string> = {
  police: "Police",
  fire: "Fire & rescue",
  ambulance: "Ambulance",
  frsc: "Road safety",
  nema: "Disaster",
  security: "Command centre",
  hotline: "Emergency line",
};

export function agenciesForState(state: string): Agency[] {
  return agencies
    .filter((a) => a.state === state || a.state === "national")
    .sort((a, b) => Number(b.state === state) - Number(a.state === state) || b.priority - a.priority);
}

export function stateAgencies(state: string): Agency[] {
  return agencies.filter((a) => a.state === state).sort((a, b) => b.priority - a.priority);
}

export const nationalAgencies = agencies.filter((a) => a.state === "national");

/** First callable number that isn't a short code, for "call this agency" buttons. */
export function primaryLine(agency: Agency): string {
  return agency.phones.find((p) => p.length > 4) ?? agency.phones[0];
}
