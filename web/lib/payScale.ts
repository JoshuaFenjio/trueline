// The one Pay Score scale for the whole site (index-site style). 5 diverging
// steps, legible on white. This REPLACES the old score coloring everywhere.
export interface Band { min: number; color: string; label: string; range: string; }

export const PAY_BANDS: Band[] = [
  { min: 80, color: "#0F7A48", label: "Top payer", range: "80–100" },
  { min: 65, color: "#1E9E6A", label: "Above market", range: "65–79" },
  { min: 50, color: "#C98A1E", label: "At market", range: "50–64" },
  { min: 35, color: "#9A5B2A", label: "Below", range: "35–49" },
  { min: 0, color: "#D6452B", label: "Underpayer", range: "<35" },
];

export function payBand(score: number): Band {
  return PAY_BANDS.find((b) => score >= b.min) || PAY_BANDS[PAY_BANDS.length - 1];
}
export function payColor(score: number): string {
  return payBand(score).color;
}
export function payLabel(score: number): string {
  return payBand(score).label;
}
