export type Level = "Junior" | "Mid" | "Senior" | "Staff+";

// Ladder order, junior -> staff+.
export const LEVELS: Level[] = ["Junior", "Mid", "Senior", "Staff+"];

// URL slug for a level ("Staff+" -> "staff") and the inverse. Used by the
// /roles/[role]/[level] pages.
export function levelSlug(l: Level): string {
  return l === "Staff+" ? "staff" : l.toLowerCase();
}
export function levelFromSlug(s: string): Level | null {
  return LEVELS.find((l) => levelSlug(l) === s.toLowerCase()) ?? null;
}

// Internship / working-student / apprentice / trainee roles. Their pay is a
// stipend, not a professional base — keep the row but exclude it from medians.
const TRAINEE_RE =
  /\b(intern|interns|internship|working[- ]student|werkstudent(?:in)?|apprentice|apprenticeship|apprenti(?:e|ssage)?|trainee|traineeship|praktik(?:um|ant(?:in)?)|stagiaire|alternance|alternant(?:e)?|dual study|duales studium|ausbildung|azubi|dhbw|placement (?:year|student)|sandwich (?:year|placement)|graduate scheme)\b/i;

export function isTrainee(title: string | null): boolean {
  return TRAINEE_RE.test(title || "");
}

// Parse a level bucket from a job title. staff / principal / lead -> Staff+.
// Cues are multilingual + numeric where the signal is honest (Roman "III" is
// industry-standard senior, "IV" staff; German Leiter / French Responsable =
// head). A title with NO seniority signal has no honest level — see
// levelHasSignal(); we default it to Mid (a professional role's reasonable
// centre) but callers can treat unsignalled rows as level-unknown instead.
export function levelBucket(title: string | null): Level {
  const t = (title || "").toLowerCase();
  if (/\b(intern|internship|working student|apprentice|apprenti|graduate|entry[- ]level|junior|jr\.?|trainee|d[eé]butant|ausbildung|azubi|praktikant|werkstudent)\b/.test(t))
    return "Junior";
  // NB: bare "manager" is deliberately NOT here. "Manager" denotes a role
  // function, not a seniority tier — "Product Manager" / "Account Manager" are
  // IC/mid roles, and mapping every "* Manager" to Staff+ collapsed those whole
  // families into one band. Real leadership words (head/director/vp/chief/lead/
  // principal/staff + German Leiter / French Responsable) stay here; a plain
  // "Manager" falls through to Mid.
  if (/\b(staff|principal|distinguished|fellow|lead|head of|head,|director|directeur|directrice|vp|vice president|chief|c[te]o|leiter|leitung|teamleiter|gesch[aä]ftsf[uü]hrer|responsable|chef de|chef d'[eé]quipe|iv)\b/.test(t))
    return "Staff+";
  if (/\b(senior|sr\.?|snr|iii|confirm[eé]|leitender)\b/.test(t)) return "Senior";
  if (/\b(mid[- ]level|intermediate|medior|ii)\b/.test(t)) return "Mid";
  return "Mid";
}

// True when the title carries ANY explicit seniority signal. Rows where this is
// false are "level-unknown" — Mid is only an inferred default for them, so
// level-sliced views can choose to exclude them rather than guess a band.
export function levelHasSignal(title: string | null): boolean {
  const t = (title || "").toLowerCase();
  return /\b(intern|internship|working student|apprentice|apprenti|graduate|entry[- ]level|junior|jr\.?|trainee|d[eé]butant|ausbildung|azubi|praktikant|werkstudent|staff|principal|distinguished|fellow|lead|head of|head,|director|directeur|directrice|vp|vice president|chief|c[te]o|leiter|leitung|teamleiter|gesch[aä]ftsf[uü]hrer|responsable|chef de|chef d'[eé]quipe|iv|senior|sr\.?|snr|iii|confirm[eé]|leitender|mid[- ]level|intermediate|medior|ii)\b/.test(t);
}
