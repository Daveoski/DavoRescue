import type { CapacitorConfig } from "@capacitor/cli";

// The Android app is a native shell around the live site, so every web
// release reaches app users immediately. The native project lives at the
// repository root in /android; `capacitor-shell` holds the offline fallback.
const siteUrl = process.env.CAP_SERVER_URL ?? "https://davorescue.vercel.app";

const config: CapacitorConfig = {
  appId: "ng.davorescue.app",
  appName: "DavoRescue",
  webDir: "capacitor-shell",
  server: {
    url: `${siteUrl}/report?source=android`,
    androidScheme: "https",
    errorPath: "offline.html",
    allowNavigation: [new URL(siteUrl).host],
  },
  android: {
    path: "../android",
    backgroundColor: "#16181d",
  },
};

export default config;
