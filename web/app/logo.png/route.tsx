import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 512×512 raster of the brand mark (app/icon.svg) on white, for
// Organization.logo — search engines want a crawlable bitmap logo, and the
// repo has no raster. Rendered once at build (force-static).
export const dynamic = "force-static";

export function GET() {
  const svg = readFileSync(join(process.cwd(), "app", "icon.svg"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={400} height={400} alt="" />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
