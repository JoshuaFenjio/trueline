import { ImageResponse } from "next/og";

export const runtime = "edge";

// Simple, on-brand OG card: dark bg, kicker, big headline, accent value.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kicker = (searchParams.get("kicker") || "EMEA salary intelligence").slice(0, 60);
  const title = (searchParams.get("title") || "Know what Europe actually pays").slice(0, 80);
  const value = (searchParams.get("value") || "Live from company job boards").slice(0, 60);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "72px", backgroundColor: "#07080B",
          backgroundImage: "linear-gradient(160deg, rgba(124,108,255,0.22), rgba(7,8,11,0) 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundImage: "linear-gradient(92deg,#8F7BFF,#5E8BFF,#4EC9FF)" }} />
          <div style={{ color: "#F4F5F7", fontSize: 30, fontWeight: 700 }}>Trueline</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ color: "#A3A9B5", fontSize: 26, letterSpacing: 4, textTransform: "uppercase" }}>{kicker}</div>
          <div style={{ color: "#F4F5F7", fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
          <div
            style={{
              display: "flex", fontSize: 52, fontWeight: 700, color: "transparent",
              backgroundImage: "linear-gradient(92deg,#8F7BFF,#5E8BFF,#4EC9FF)",
              backgroundClip: "text", WebkitBackgroundClip: "text",
            }}
          >
            {value}
          </div>
        </div>

        <div style={{ display: "flex", color: "#6E7480", fontSize: 24 }}>
          Real advertised base salaries · Europe, Middle East &amp; Africa
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
