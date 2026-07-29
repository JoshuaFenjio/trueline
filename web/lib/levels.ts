export type Level = "Junior" | "Mid" | "Senior" | "Staff+" | "Lead/Mgr";

export const LEVELS: Level[] = ["Junior", "Mid", "Senior", "Staff+", "Lead/Mgr"];

// Parse a level bucket from a job title using keyword rules.
export function levelBucket(title: string | null): Level {
  const t = (title || "").toLowerCase();
  if (/\b(intern|internship|working student|apprentice|graduate|entry[- ]level|junior|trainee)\b/.test(t))
    return "Junior";
  // Check Staff/Principal before Senior so "Senior Staff" -> Staff+.
  if (/\b(staff|principal|distinguished|fellow)\b/.test(t)) return "Staff+";
  if (/\b(head of|head,|director|vp|vice president|chief|c[te]o|engineering manager|group manager|people manager|team lead|tech lead|lead )\b/.test(t))
    return "Lead/Mgr";
  if (/\b(senior|sr\.?|snr|staff engineer)\b/.test(t)) return "Senior";
  return "Mid";
}
