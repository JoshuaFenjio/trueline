import { ImageResponse } from "next/og";

export const runtime = "edge";

// Load Geist Mono (woff — satori doesn't accept woff2) for on-brand figures.
// Wrapped so a CDN hiccup never breaks the image (falls back to system sans).
async function loadFont(weight: number): Promise<ArrayBuffer | null> {
  try {
    const url = `https://cdn.jsdelivr.net/npm/@fontsource/geist-mono@5/files/geist-mono-latin-${weight}-normal.woff`;
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

  const [regular, bold] = await Promise.all([loadFont(400), loadFont(700)]);
  const fonts = [
    regular && { name: "Geist Mono", data: regular, weight: 400 as const, style: "normal" as const },
    bold && { name: "Geist Mono", data: bold, weight: 700 as const, style: "normal" as const },
  ].filter(Boolean) as any[];
  const ff = fonts.length ? "Geist Mono" : "monospace";

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
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: "#171614", display: "flex" }}>
            <div style={{ width: 30, height: 30, backgroundColor: "#0F766E", clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }} />
          </div>
          <div style={{ color: "#171614", fontSize: 32, fontWeight: 700, letterSpacing: -1 }}>Trueline</div>
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
          Advertised base salaries · live from company job boards · trueline
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined }
  );
}
