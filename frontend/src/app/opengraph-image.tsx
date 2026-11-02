import { ImageResponse } from "next/og";

export const alt = "DavoRescue — report emergencies on Enugu and South-East roads";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16181d",
          color: "#fbfaf7",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#23272f" />
            <path d="M16 5.5c-4.6 0-8.3 3.6-8.3 8.1 0 6 8.3 12.9 8.3 12.9s8.3-6.9 8.3-12.9c0-4.5-3.7-8.1-8.3-8.1z" fill="#d63a1f" />
            <path d="M12.6 13.7h6.8M16 10.3v6.8" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 800, display: "flex" }}>
            Davo<span style={{ color: "#ff5b3d" }}>Rescue</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>Report it once.</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: "#ff5b3d" }}>
            The right responders know where.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#b9b4aa" }}>
          <span>Robbery · Kidnapping · Shooting · Fire · Medical</span>
          <span>Enugu & the South-East</span>
        </div>
        <div style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 12, display: "flex" }}>
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} style={{ width: 30, height: 12, background: i % 2 ? "#16181d" : "#f2a93b" }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
