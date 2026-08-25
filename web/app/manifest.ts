import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalaryRadar",
    short_name: "SalaryRadar",
    description: "See who pays the most. Real EMEA salary benchmarks from live job postings.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbf9",
    theme_color: "#0F766E",
    icons: [{ src: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
  };
}
