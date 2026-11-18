// Computed copy for SEO surfaces: titles, meta descriptions, answer-first
// sentences and FAQ items. Every sentence is a template over live figures —
// nothing is hand-written per page, and a sentence whose inputs don't compute
// is dropped rather than padded.
import { familyLabel, isGroupFamily } from "./roleNames";

/** The role as a countable noun: "Software Engineer", "Finance role". */
export function roleNoun(role: string): string {
  const label = familyLabel(role);
  return isGroupFamily(role) ? `${label} role` : label;
}

/** Plural people/roles form: "Software Engineers", "Finance roles". */
export function rolePlural(role: string): string {
  const label = familyLabel(role);
  return isGroupFamily(role) ? `${label} roles` : `${label}s`;
}

/** "a Software Engineer" / "an Account Executive" / "an SDR / BDR". */
export function withArticle(noun: string): string {
  const first = noun.split(/[\s/]/)[0] || noun;
  const acronym = first.length > 1 && first === first.toUpperCase() && /[A-Z]/.test(first);
  const an = acronym ? /^[AEFHILMNORSX]/.test(first) : /^[aeiou]/i.test(first);
  return `${an ? "an" : "a"} ${noun}`;
}

/**
 * Whether a family may carry Occupation markup. Only genuine job titles: a
 * group family ("Finance", "Operations") describes a function spanning many
 * occupations, and "Other" is an unclassified bucket — marking either up as a
 * single Occupation would misstate what the number measures.
 */
export function occupationEligible(role: string): boolean {
  return !isGroupFamily(role);
}
