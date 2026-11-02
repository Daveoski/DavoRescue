export const site = {
  name: "DavoRescue",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://davorescue.vercel.app").replace(/\/$/, ""),
  tagline: "Emergency reporting and response for Enugu and the South-East",
  description:
    "Report robbery, kidnapping, shooting, explosions, fire and medical emergencies in Enugu, Anambra, Abia, Ebonyi and Imo. DavoRescue pins the exact road, verifies the report and alerts police, fire and ambulance services.",
  apkUrl: "https://github.com/Daveoski/DavoRescue/releases/latest/download/DavoRescue.apk",
  repoUrl: "https://github.com/Daveoski/DavoRescue",
  emergencyLine: "112",
  enuguHotline: "09134666668",
} as const;

export const states = [
  { slug: "enugu", name: "Enugu", capital: "Enugu", lat: 6.4584, lng: 7.5464 },
  { slug: "anambra", name: "Anambra", capital: "Awka", lat: 6.2104, lng: 7.07 },
  { slug: "abia", name: "Abia", capital: "Umuahia", lat: 5.5263, lng: 7.4896 },
  { slug: "ebonyi", name: "Ebonyi", capital: "Abakaliki", lat: 6.3249, lng: 8.1137 },
  { slug: "imo", name: "Imo", capital: "Owerri", lat: 5.485, lng: 7.035 },
] as const;

export type StateSlug = (typeof states)[number]["slug"];
