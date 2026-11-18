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

// ---------------------------------------------------------------------------
// Answer-first sentence + computed FAQ.
//
// The sentence is self-contained (subject, place, figure, sample, source,
// date) so it survives being quoted out of context. FAQ answers are each
// self-contained too. Every figure uses eurExact — the same €1,000 rounding
// the stat cards and the Occupation schema use. Items whose inputs don't
// compute are dropped, never padded.
// ---------------------------------------------------------------------------
import type { Faq } from "./seo";
import { eurExact, BRAND } from "./seo";

export const EMEA_PLACE = "Europe, the Middle East and Africa";

// Country names that take a definite article in running English.
const THE = new Set(["United Kingdom", "Netherlands", "United Arab Emirates", "Czech Republic", "Philippines", "United States", "Faroe Islands", "Isle of Man", "Channel Islands", "Vatican City"]);
/** Place name as it reads after "in": "the Netherlands", "Germany", "Berlin". */
export function inPlace(place: string): string {
  return THE.has(place) ? `the ${place}` : place;
}

export function answerSentence(p: { subject: string; place: string; median: number; n: number; updated: string | null }): string {
  return `The median advertised base salary for ${p.subject} in ${inPlace(p.place)} is ${eurExact(p.median)}, from ${p.n.toLocaleString("en-IE")} salaried live job ads tracked by ${BRAND}${p.updated ? ` (updated ${p.updated})` : ""}.`;
}

/** FAQ for a role-scoped page (role, role × level, role × place). */
export function roleFaqs(p: {
  noun: string; plural: string; place: string;
  median: number; p25: number; p75: number; p90: number; n: number;
  board: { tracked: number; disclosed: number }; // complete employer feeds only
  leader?: { kind: "country" | "city" | "company"; name: string; median: number } | null;
}): Faq[] {
  const out: Faq[] = [
    {
      q: `How much does ${withArticle(p.noun)} earn in ${inPlace(p.place)}?`,
      a: `Job ads for ${p.plural} in ${inPlace(p.place)} advertise a median base salary of ${eurExact(p.median)} a year; the middle half of ${p.n.toLocaleString("en-IE")} salaried ads offer between ${eurExact(p.p25)} and ${eurExact(p.p75)}.`,
    },
    {
      q: `What do the best-paid ${p.plural} in ${inPlace(p.place)} earn?`,
      a: `The top 10% of salaried ${p.noun} job ads in ${inPlace(p.place)} advertise an annual base salary of ${eurExact(p.p90)} or more.`,
    },
  ];
  if (p.leader) {
    const where = p.leader.kind === "company" ? "employer" : p.leader.kind;
    out.push({
      q: `Which ${where} pays ${p.plural} the most in ${inPlace(p.place)}?`,
      a: `${p.leader.name} has the highest median advertised base for ${p.plural} in ${inPlace(p.place)} that clears our sample gate, at ${eurExact(p.leader.median)}.`,
    });
  }
  if (p.board.tracked >= 20) {
    out.push({
      q: `How many ${p.noun} job ads in ${inPlace(p.place)} disclose salary?`,
      a: `On employers' own job boards, ${p.board.disclosed.toLocaleString("en-IE")} of the ${p.board.tracked.toLocaleString("en-IE")} live ${p.noun} job ads in ${inPlace(p.place)} tracked by ${BRAND} state a salary (${Math.round((p.board.disclosed / p.board.tracked) * 100)}%).`,
    });
  }
  return out;
}

/** FAQ for a place page (city or country, all roles). */
export function placeFaqs(p: {
  place: string; median: number; n: number;
  board: { tracked: number; disclosed: number }; // complete employer feeds only
  topRole?: { label: string; median: number } | null;
  topCompany?: { name: string; median: number } | null;
}): Faq[] {
  const out: Faq[] = [{
    q: `What is the median salary in ${inPlace(p.place)}?`,
    a: `Across all tracked roles, job ads in ${inPlace(p.place)} advertise a median base salary of ${eurExact(p.median)} a year, from ${p.n.toLocaleString("en-IE")} salaried live job ads.`,
  }];
  if (p.topRole) out.push({
    q: `Which role family pays the most in ${inPlace(p.place)}?`,
    a: `${p.topRole.label} has the highest median advertised base in ${inPlace(p.place)} among role families with at least 8 salaried ads, at ${eurExact(p.topRole.median)}.`,
  });
  if (p.topCompany) out.push({
    q: `Which company pays the most in ${inPlace(p.place)}?`,
    a: `${p.topCompany.name} has the highest median advertised base in ${inPlace(p.place)} among employers with at least 3 salaried ads, at ${eurExact(p.topCompany.median)}.`,
  });
  if (p.board.tracked >= 20) out.push({
    q: `What share of job ads in ${inPlace(p.place)} disclose salary?`,
    a: `On employers' own job boards, ${Math.round((p.board.disclosed / p.board.tracked) * 100)}% of the ${p.board.tracked.toLocaleString("en-IE")} live job ads in ${inPlace(p.place)} tracked by ${BRAND} state a salary.`,
  });
  return out;
}

/** Level-qualified noun: "Senior Software Engineer" / "Account Executive at Director level". */
export function levelNoun(level: string, role: string, management: boolean): string {
  const noun = roleNoun(role);
  return management ? `${noun} at ${level} level` : `${level} ${noun}`;
}
