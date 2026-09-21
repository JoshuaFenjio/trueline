import "server-only";
import crypto from "crypto";
import { getServiceClient } from "./admin";
import { getData } from "./data";
import { latestFor, type PostingVM } from "./postings";
import { slugify } from "./format";
import { familyLabel } from "./roleNames";

// HMAC magic-link token — stateless-verifiable AND stored, so a link can't be
// forged without the server secret. Keyed off the service key (server-only).
const SECRET = process.env.SUPABASE_SERVICE_KEY || "dev-secret";
export function requestToken(email: string, queryNorm: string): string {
  return crypto.createHmac("sha256", SECRET).update(`${email}|${queryNorm}`).digest("hex").slice(0, 32);
}

export function normQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

// What we can honestly say about a requested role, derived from the postings we
// already track (never a promise to summon data):
//   matching  — live tracked postings whose advertised title carries every word
//               of the query
//   postings  — the most recent of those, so the page SHOWS the evidence
//   families  — the role families those postings already sit in, ranked, so we
//               can deep-link the closest-matching page(s)
//   exact     — set when the query IS one of our families (or its display name)
export interface RequestMatch {
  matching: number;
  postings: PostingVM[];
  families: { name: string; label: string; slug: string; n: number }[];
  exact: { name: string; label: string; slug: string } | null;
}

const EMPTY_MATCH: RequestMatch = { matching: 0, postings: [], families: [], exact: null };

export async function matchInfo(query: string, limit = 15): Promise<RequestMatch> {
  const q = normQuery(query);
  if (q.length < 2) return EMPTY_MATCH;
  const rows = await getData();

  // All-words match on the advertised title — "senior data engineer" should hit
  // "Senior Data Engineer (m/f/d)", which a raw substring never would.
  const terms = q.split(" ").filter(Boolean);
  const isHit = (t: string) => { const l = t.toLowerCase(); return terms.every((w) => l.includes(w)); };
  const hits = rows.filter((r) => isHit(r.title));

  const counts = new Map<string, number>();
  for (const r of hits) {
    if (!r.roleFamily || r.roleFamily === "Other") continue;
    counts.set(r.roleFamily, (counts.get(r.roleFamily) || 0) + 1);
  }
  let families = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => ({ name, label: familyLabel(name), slug: slugify(name), n }));

  // Nothing matched on titles? Fall back to families whose own name/label reads
  // like the query, so the user still lands somewhere real.
  if (families.length === 0) {
    const all = [...new Set(rows.map((r) => r.roleFamily))].filter((f) => f && f !== "Other");
    families = all
      .filter((f) => isHit(f) || isHit(familyLabel(f)))
      .slice(0, 3)
      .map((name) => ({ name, label: familyLabel(name), slug: slugify(name), n: rows.filter((r) => r.roleFamily === name).length }));
  }

  const exactName = [...new Set(rows.map((r) => r.roleFamily))]
    .filter((f) => f && f !== "Other")
    .find((f) => normQuery(f) === q || normQuery(familyLabel(f)) === q || slugify(f) === slugify(q));

  return {
    matching: hits.length,
    postings: latestFor(rows, (r) => isHit(r.title), limit),
    families,
    exact: exactName ? { name: exactName, label: familyLabel(exactName), slug: slugify(exactName) } : null,
  };
}

// Live count of tracked postings that may match the query — the honest
// "we already track [X] postings that may match" number.
export async function countMatching(query: string): Promise<number> {
  return (await matchInfo(query, 0)).matching;
}

// --- per-IP rate limit (in-memory, per warm instance) ----------------------
const MAX = 5;
const WINDOW = 60 * 60_000; // 5 requests / hour / IP
const hits = new Map<string, { n: number; start: number }>();
export function requestRate(ip: string): { ok: boolean } {
  const now = Date.now();
  const b = hits.get(ip);
  if (!b || now - b.start > WINDOW) { hits.set(ip, { n: 1, start: now }); return { ok: true }; }
  b.n += 1;
  return { ok: b.n <= MAX };
}

export interface RoleRequest {
  id: number; query: string; email: string; status: string;
  matching_n: number; family_assigned: string | null;
  created_at: string; verified_at: string | null;
}

// Insert (or refresh) a request. Returns the token + matching count. Gracefully
// reports if the table hasn't been migrated yet.
export async function createRequest(query: string, email: string, knownMatching?: number):
  Promise<{ ok: boolean; token?: string; matching?: number; error?: string }> {
  const sb = getServiceClient();
  if (!sb) return { ok: false, error: "unconfigured" };
  const qnorm = normQuery(query);
  const token = requestToken(email, qnorm);
  const matching = knownMatching ?? (await countMatching(query));
  const { error } = await sb.from("role_requests").insert({
    query: query.slice(0, 120), query_norm: qnorm, email: email.slice(0, 200),
    status: "pending", token, matching_n: matching,
  });
  if (error) {
    // PostgREST reports a missing table as "Could not find the table … in the
    // schema cache" (or "relation … does not exist"). Treat as "not migrated".
    if (/role_requests/i.test(error.message) && /(does not exist|could not find the table|schema cache)/i.test(error.message))
      return { ok: false, error: "not_migrated" };
    return { ok: false, error: error.message };
  }
  return { ok: true, token, matching };
}

export async function verifyRequest(email: string, queryNorm: string, token: string):
  Promise<{ ok: boolean; query?: string; matching?: number }> {
  const sb = getServiceClient();
  if (!sb) return { ok: false };
  if (token !== requestToken(email, queryNorm)) return { ok: false };
  const { data } = await sb.from("role_requests")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("email", email).eq("query_norm", queryNorm).eq("token", token)
    .select("query, matching_n").limit(1);
  const row = data?.[0] as any;
  return { ok: true, query: row?.query, matching: row?.matching_n };
}
