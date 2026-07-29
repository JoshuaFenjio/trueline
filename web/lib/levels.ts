export type Level = "Junior" | "Mid" | "Senior" | "Staff+";

// Ladder order, junior -> staff+.
export const LEVELS: Level[] = ["Junior", "Mid", "Senior", "Staff+"];

// Parse a level bucket from a job title. staff / principal / lead -> Staff+.
export function levelBucket(title: string | null): Level {
  const t = (title || "").toLowerCase();
  if (/\b(intern|internship|working student|apprentice|graduate|entry[- ]level|junior|trainee)\b/.test(t))
    return "Junior";
  if (/\b(staff|principal|distinguished|fellow|lead|head of|head,|director|vp|vice president|chief|c[te]o|manager)\b/.test(t))
    return "Staff+";
  if (/\b(senior|sr\.?|snr)\b/.test(t)) return "Senior";
  return "Mid";
}
