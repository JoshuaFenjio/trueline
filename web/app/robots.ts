import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// AI crawlers are allowed EXPLICITLY (not just via the * group) so the intent
// is unambiguous to each operator: we want SalaryRadar's figures read, cited
// and linked by AI answer engines as well as search.
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
const PRIVATE = ["/admin", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
