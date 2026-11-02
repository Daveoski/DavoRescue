import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Public_Sans } from "next/font/google";

import { site } from "@/shared/config/site";
import { EmergencyStrip } from "@/shared/ui/emergency-strip";
import { JsonLd } from "@/shared/ui/json-ld";
import { ServiceWorker } from "@/shared/ui/service-worker";
import { SiteFooter } from "@/shared/ui/site-footer";
import { SiteHeader } from "@/shared/ui/site-header";

import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", axes: ["wdth"], display: "swap" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "DavoRescue — Report emergencies on Enugu & South-East roads",
    template: "%s · DavoRescue",
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "Enugu emergency number",
    "report kidnapping Enugu",
    "Enugu police emergency line",
    "South-East Nigeria road safety",
    "Enugu fire service number",
    "ambulance Enugu",
    "report robbery Nigeria",
    "112 Nigeria",
    "Anambra police number",
    "Abia Ebonyi Imo emergency",
  ],
  category: "public safety",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: site.url,
    siteName: site.name,
    title: "DavoRescue — Report emergencies on Enugu & South-East roads",
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "DavoRescue — Report emergencies on Enugu & South-East roads",
    description: site.description,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
  ],
};

const organisation = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#org`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon.svg`,
      areaServed: ["Enugu State", "Anambra State", "Abia State", "Ebonyi State", "Imo State"].map((name) => ({
        "@type": "State",
        name,
        containedInPlace: { "@type": "Country", name: "Nigeria" },
      })),
      sameAs: [site.repoUrl],
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#site`,
      url: site.url,
      name: site.name,
      publisher: { "@id": `${site.url}/#org` },
      inLanguage: "en-NG",
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={`${archivo.variable} ${publicSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[999] focus:btn">
          Skip to content
        </a>
        <EmergencyStrip />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <ServiceWorker />
        <JsonLd data={organisation} />
      </body>
    </html>
  );
}
