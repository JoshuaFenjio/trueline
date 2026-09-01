import "server-only";
import crypto from "crypto";
import { getServiceClient } from "./admin";

// HMAC magic-link token — stateless-verifiable AND stored, so a link can't be
// forged without the server secret. Keyed off the service key (server-only).
const SECRET = process.env.SUPABASE_SERVICE_KEY || "dev-secret";
export function requestToken(email: string, queryNorm: string): string {
  return crypto.createHmac("sha256", SECRET).update(`${email}|${queryNorm}`).digest("hex").slice(0, 32);
}

export function normQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

// Live count of active postings whose title contains the query — the honest
// "we already track [X] postings that may match" number.
export async function countMatching(query: string): Promise<number> {
  const sb = getServiceClient();
  if (!sb) return 0;
  const q = normQuery(query);
  if (q.length < 2) return 0;
  // escape PostgREST ilike wildcards in the user string
  const safe = q.replace(/[%_,()*]/g, " ").trim();
  const { count } = await sb
    .from("job_postings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .ilike("title", `%${safe}%`);
  return count || 0;
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
export async function createRequest(query: string, email: string):
  Promise<{ ok: boolean; token?: string; matching?: number; error?: string }> {
  const sb = getServiceClient();
  if (!sb) return { ok: false, error: "unconfigured" };
  const qnorm = normQuery(query);
  const token = requestToken(email, qnorm);
  const matching = await countMatching(query);
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
