import { ImageResponse } from "next/og";

export const runtime = "edge";

// Load Geist Mono (woff — satori doesn't accept woff2) for on-brand figures,
// and Schibsted Grotesk for the brand wordmark, which is set in the site face
// and looked wrong in a monospace. Wrapped so a CDN hiccup never breaks the
// image (each falls back independently to the system stack).
async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://cdn.jsdelivr.net/npm/@fontsource/${family}@5/files/${family}-latin-${weight}-normal.woff`;
    const res = await fetch(url, { cache: "force-cache" });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kicker = (searchParams.get("kicker") || "EMEA salary intelligence").slice(0, 64);
  const title = (searchParams.get("title") || "Know what Europe actually pays").slice(0, 40);
  const value = (searchParams.get("value") || "Live from company job boards").slice(0, 70);

  const [regular, bold, brand] = await Promise.all([
    loadFont("geist-mono", 400), loadFont("geist-mono", 700), loadFont("schibsted-grotesk", 800),
  ]);
  const fonts = [
    regular && { name: "Geist Mono", data: regular, weight: 400 as const, style: "normal" as const },
    bold && { name: "Geist Mono", data: bold, weight: 700 as const, style: "normal" as const },
    brand && { name: "Schibsted Grotesk", data: brand, weight: 800 as const, style: "normal" as const },
  ].filter(Boolean) as any[];
  const ff = regular || bold ? "Geist Mono" : "monospace";
  const brandFf = brand ? "Schibsted Grotesk" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "76px", backgroundColor: "#FAFAF7",
          backgroundImage: "linear-gradient(150deg, rgba(15,118,110,0.08), rgba(250,250,247,0) 46%)",
          fontFamily: ff,
        }}
      >
        {/* Brand lockup — the exact compass from components/BrandMark, at the
            reference's proportions (gap 0.315H, cap height 0.469H). Flat brand
            green: Satori renders SVG gradients inconsistently, and the lockup's
            identity is the geometry, not the shading. */}
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <svg width="48" height="48" viewBox="0 0 64 64">
            <path d="M48.25 10.44A27 27 0 0 0 13.24 51.42M21.89 57.03A27 27 0 0 0 51.42 13.24" fill="none" stroke="#059C62" strokeWidth="6" />
            <path fillRule="evenodd" fill="#059C62" d="M27.44 27.82L44.78 18.05L36.56 36.18L18.59 46.63ZM34.08 32A2.08 2.08 0 1 0 29.92 32A2.08 2.08 0 1 0 34.08 32Z" />
            <circle cx="32" cy="32" r="4.5" fill="none" stroke="#059C62" strokeWidth="4.85" />
          </svg>
          <div style={{ color: "#059C62", fontFamily: brandFf, fontSize: 31, fontWeight: 800, letterSpacing: -1.1 }}>SalaryRadar</div>
        </div>

        {/* Headline stat */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#5B6472", fontSize: 30, letterSpacing: 3, textTransform: "uppercase" }}>{kicker}</div>
          <div
            style={{
              maxWidth: 1040, fontSize: title.length <= 16 ? 112 : 66, fontWeight: 800,
              lineHeight: 1.05, letterSpacing: -2, color: "#171614",
            }}
          >
            {title}
          </div>
          <div style={{ color: "#0F766E", fontSize: 34, fontWeight: 700 }}>{value}</div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", color: "#98A1AD", fontSize: 24 }}>
          Advertised base salaries · live from company job boards · salaryradar
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined }
  );
}
