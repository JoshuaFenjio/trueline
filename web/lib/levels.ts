export type Level =
  | "Junior" | "Mid" | "Senior" | "Staff+"
  | "Manager" | "Senior Manager" | "Director" | "Senior Director" | "VP+";

// Individual-contributor ladder, junior -> staff+.
export const IC_LEVELS: Level[] = ["Junior", "Mid", "Senior", "Staff+"];
// Management track. Entered ONLY on an explicit title signal — never inferred
// from a role family, a salary, or anything else. See classifyLevel().
export const MGMT_LEVELS: Level[] = ["Manager", "Senior Manager", "Director", "Senior Director", "VP+"];
export const LEVELS: Level[] = [...IC_LEVELS, ...MGMT_LEVELS];

export function isManagementLevel(l: Level): boolean {
  return (MGMT_LEVELS as string[]).includes(l);
}

// URL slug for a level ("Staff+" -> "staff", "Senior Manager" ->
// "senior-manager") and the inverse. Used by /roles/[role]/[level].
export function levelSlug(l: Level): string {
  return l.toLowerCase().replace(/\+/g, "").trim().replace(/\s+/g, "-");
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

// ---------------------------------------------------------------------------
// Level classification. MIRRORS pipeline.classify_level EXACTLY — the pipeline
// stores the result, this is the read-time fallback for rows written before a
// backfill, so the two must never diverge.
//
// Two tracks:
//   IC          Junior, Mid, Senior, Staff+
//   Management  Manager, Senior Manager, Director, Senior Director, VP+
//
// A bare "Manager" is deliberately NOT a management signal — "Product Manager"
// and "Account Manager" are IC roles, and mapping every "* Manager" to a tier
// collapsed whole families into one band. Only titles naming a management
// FUNCTION qualify (Engineering Manager, Team Lead, Head of…, Leiter,
// Responsable). Everything below is an explicit title signal; a title with no
// signal at all has no honest level, and `explicit` comes back false so callers
// can exclude it rather than guess.
// ---------------------------------------------------------------------------
const LVL_JUNIOR = /\b(intern|internship|working student|apprentice|apprenti|graduate|entry[- ]level|junior|jr\.?|trainee|d[eé]butant|ausbildung|azubi|praktikant|werkstudent)\b/i;

// VP+ — the top of the management track.
const LVL_VP = new RegExp(
  "\\b(svp|evp|senior vice president|executive vice president|vice president|vp)\\b" +
  "|\\bchief\\b" +
  "|\\b(cto|ceo|cfo|coo|cpo|cmo|cro|cio|ciso|cdo|chro)\\b" +
  "|\\bc[- ](level|suite)\\b" +
  "|\\bmanaging director\\b|\\bgesch[aä]e?ftsf[uü]e?hrer(in)?\\b|\\bvorstand\\b" +
  "|\\bdirecteur g[eé]n[eé]ral\\b",
  "i"
);
// "Chief of Staff" is a strategy IC role — neither C-level nor Staff+. Stripped
// before the VP+/Staff+ tests so neither "chief" nor "staff" fires on it.
const LVL_CHIEF_IC = /\bchief of staff\b/gi;

// Team leadership — tested BEFORE Director so "Teamleiter" doesn't read as a
// department head.
const LVL_TEAM_LEAD = new RegExp(
  "\\bteam[- ]?(lead|leader|leiter(in)?|leitung|manager)\\b" +
  "|\\bgruppenleiter(in)?\\b|\\bpeople manager\\b|\\bline manager\\b" +
  "|\\bchef d[e’']\\s?[eé]quipe\\b|\\bresponsable d[e’']\\s?[eé]quipe\\b",
  "i"
);

// Director / head-of. "Art Director" and friends are IC craft titles, not heads.
const LVL_DIRECTOR = new RegExp(
  "\\bdirector\\b|\\bdirectrice\\b|\\bdirecteur\\b|\\bhead of\\b|\\bhead,\\b" +
  "|\\b(bereichs|abteilungs|standort|werks?|niederlassungs|haupt)leiter(in)?\\b" +
  "|\\bleiter(in)?\\b|\\bleitung\\b",
  "i"
);
const LVL_DIRECTOR_IC = /\b(art|creative|casting|music|photography|funeral|film|video|studio|stage)\s+director\b|\bdirector of photography\b/i;

// People-management "Manager" titles — an INCLUDE list, so ambiguous
// "* Manager" roles (product, account, project, marketing…) never enter.
const LVL_MANAGER = new RegExp(
  "\\b(engineering|software|development|dev|platform|infrastructure|data|analytics|design|research|security|qa|test|it|technical|technology)\\s+manager\\b" +
  "|\\bmanager,?\\s+(engineering|software|platform|infrastructure|data|design|security|qa|research|technology)\\b" +
  "|\\bpersonalleiter(in)?\\b|\\bchef de service\\b|\\bresponsable\\b",
  "i"
);

// IC senior track. Leadership words that now belong to the management track
// (head of / director / vp / chief / leiter / responsable / chef de) were
// removed from here — they were all collapsing into Staff+.
const LVL_STAFF = /\b(staff|principal|distinguished|fellow|lead|iv)\b/i;
const LVL_SENIOR = /\b(senior|sr\.?|snr|iii|confirm[eé]|leitender)\b/i;
const LVL_MID = /\b(mid[- ]level|intermediate|medior|ii)\b/i;

/**
 * Fold diacritics before matching.
 *
 * Python's \b is Unicode-aware ("é" and "ț" are word characters) while
 * JavaScript's is ASCII-only, so the same title classified differently on the
 * two sides ("Développeur confirmé" lost its Senior signal here; "instalații"
 * gained a bogus Roman-numeral "II"). Folding to ASCII letters first makes the
 * two implementations agree AND makes both more correct.
 * pipeline._lvl_norm does exactly the same thing.
 */
function lvlNorm(title: string | null): string {
  return (title || "").normalize("NFKD").replace(/\p{M}/gu, "");
}

export function classifyLevel(title: string | null): { level: Level; explicit: boolean } {
  const t = lvlNorm(title);
  const tc = t.replace(LVL_CHIEF_IC, " ");
  const snr = LVL_SENIOR.test(t);
  if (LVL_JUNIOR.test(t)) return { level: "Junior", explicit: true };
  if (LVL_VP.test(tc)) return { level: "VP+", explicit: true };
  if (LVL_TEAM_LEAD.test(t)) return { level: snr ? "Senior Manager" : "Manager", explicit: true };
  if (LVL_DIRECTOR.test(t) && !LVL_DIRECTOR_IC.test(t)) return { level: snr ? "Senior Director" : "Director", explicit: true };
  if (LVL_MANAGER.test(t)) return { level: snr ? "Senior Manager" : "Manager", explicit: true };
  if (LVL_STAFF.test(tc)) return { level: "Staff+", explicit: true };
  if (snr) return { level: "Senior", explicit: true };
  if (LVL_MID.test(t)) return { level: "Mid", explicit: true };
  return { level: "Mid", explicit: false }; // no honest signal — Mid is a flagged fallback
}

export function levelBucket(title: string | null): Level {
  return classifyLevel(title).level;
}

// True when the title carried ANY explicit seniority signal. Rows where this is
// false are "level-unknown" — Mid is only an inferred default for them, so
// level-sliced views exclude them rather than guess a band.
export function levelHasSignal(title: string | null): boolean {
  return classifyLevel(title).explicit;
}

// ---------------------------------------------------------------------------
// Composing a level with a role-family label. "Senior Software Engineer" reads
// naturally; "Director Account Executive" and "Senior Manager Engineering
// Manager" do not. Management tiers are therefore appended, not prefixed.
// ---------------------------------------------------------------------------

/** Page heading: "Senior Software Engineer" / "Account Executive — Director". */
export function levelHeading(level: Level, label: string): string {
  return isManagementLevel(level) ? `${label} — ${level}` : `${level} ${label}`;
}

/** People form: "senior Software Engineers" / "Account Executives at Director level". */
export function levelPhrase(level: Level, plural: string): string {
  return isManagementLevel(level) ? `${plural} at ${level} level` : `${level.toLowerCase()} ${plural}`;
}

/** Roles form: "senior Software Engineer roles" / "Account Executive roles at Director level". */
export function levelRolesPhrase(level: Level, label: string): string {
  return isManagementLevel(level) ? `${label} roles at ${level} level` : `${level.toLowerCase()} ${label} roles`;
}

/** Metadata/OG title stem, without the trailing boilerplate. */
export function levelTitleStem(level: Level, label: string): string {
  return isManagementLevel(level) ? `${label} salary at ${level} level` : `${level} ${label} salary`;
}
