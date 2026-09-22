import { isAdmin, getServiceClient, adminConfigured } from "@/lib/admin";
import { login, logout, setStatus, approveRoleRequest, rejectRoleRequest } from "./actions";
import { Card, PrimaryButton } from "@/components/ui";
import { eur } from "@/lib/format";
import { getNearMiss } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

export default async function Admin({ searchParams }: { searchParams: { error?: string; left?: string; m?: string } }) {
  if (!adminConfigured) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-ink-muted">
        Admin isn&apos;t configured. Set <code className="tnum">ADMIN_PASSWORD</code> and{" "}
        <code className="tnum">SUPABASE_SERVICE_KEY</code> in the environment.
      </div>
    );
  }

  if (!isAdmin()) {
    return (
      <div className="mx-auto max-w-sm py-24">
        <span className="eyebrow-pill"><span className="eyebrow">Admin</span></span>
        <h1 className="t-h2 mt-4">Submission review</h1>
        <p className="mt-2 text-sm text-ink-muted">Sign in to review submitted salaries.</p>
        {searchParams.error === "locked" ? (
          <p className="mt-4 text-sm" style={{ color: "var(--ember)" }}>
            Too many attempts. Try again in about {searchParams.m || "15"} minute{searchParams.m === "1" ? "" : "s"}.
          </p>
        ) : searchParams.error === "1" ? (
          <p className="mt-4 text-sm" style={{ color: "var(--ember)" }}>
            Wrong password.{searchParams.left ? ` ${searchParams.left} attempt${searchParams.left === "1" ? "" : "s"} left.` : ""}
          </p>
        ) : null}
        <Card className="mt-6">
          <form action={login} className="space-y-3">
            <input name="password" type="password" placeholder="Admin password" autoFocus className="field w-full px-3 py-3" />
            <PrimaryButton className="w-full">Sign in</PrimaryButton>
          </form>
        </Card>
      </div>
    );
  }

  const sb = getServiceClient();
  const { data } = sb
    ? await sb.from("submissions").select("*").eq("status", "pending").order("created_at", { ascending: false })
    : { data: [] as any[] };
  const rows = (data as any[]) || [];

  // Role requests (growth loop). Gracefully handle the table not being migrated yet.
  const rrRes = sb
    ? await sb.from("role_requests").select("*").in("status", ["pending", "verified", "approved"]).order("created_at", { ascending: false }).limit(100)
    : { data: [] as any[], error: null };
  const requests = (rrRes.data as any[]) || [];
  const requestsMigrated = !rrRes.error;

  // Near-miss unlock kit — live each load.
  const { nearMiss, unlocked } = await getNearMiss();

  return (
    <div className="mx-auto max-w-4xl py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="t-h2">Submission review</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="tnum">{rows.length}</span> pending. Approved rows flow into stats as verified (shown at 3+ per slice).
            {" "}Bonus, equity and comments are context only — never blended into a base median.
          </p>
        </div>
        <form action={logout}><button className="btn-ghost rounded-xl px-4 py-2 text-sm">Sign out</button></form>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-8 text-center text-ink-muted">Nothing pending. All caught up.</Card>
      ) : (
        <div className="mt-8 space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="font-medium">
                  {r.company || "—"} <span className="text-ink-muted">· {r.role_family || "—"}{r.level ? ` · ${r.level}` : ""}</span>
                </div>
                {r.exact_title && <div className="mt-0.5 text-sm text-ink-muted">&ldquo;{r.exact_title}&rdquo;</div>}
                <div className="tnum mt-1 text-sm text-ink-muted">
                  {eur(r.base_eur)} base
                  {r.city ? ` · ${r.city}` : ""}{r.country ? `, ${r.country}` : ""}
                  {r.proof_type ? ` · ${r.proof_type}` : ""}
                </div>
                {/* Total-comp context: reviewer-visible, never in a median. */}
                {(r.bonus_eur || r.equity_note || r.comments) && (
                  <div className="mt-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed text-ink-muted" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
                    <span className="text-[10px] uppercase tracking-wide text-ink-faint">Total comp context — not in medians</span>
                    <div className="mt-1 space-y-0.5">
                      {r.bonus_eur ? <div className="tnum">Bonus {eur(r.bonus_eur)}</div> : null}
                      {r.equity_note ? <div>Equity: {r.equity_note}</div> : null}
                      {r.comments ? <div>{r.comments}</div> : null}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={setStatus.bind(null, r.id, "approved")}>
                  <button className="rounded-lg border px-3 py-2 text-sm" style={{ color: "var(--mint)", borderColor: "rgba(74,222,156,.35)", background: "rgba(74,222,156,.08)" }}>
                    Approve
                  </button>
                </form>
                <form action={setStatus.bind(null, r.id, "rejected")}>
                  <button className="rounded-lg border px-3 py-2 text-sm" style={{ color: "var(--ember)", borderColor: "rgba(255,106,69,.35)", background: "rgba(255,106,69,.08)" }}>
                    Reject
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Role requests — the growth loop. Approve maps the query to a family as a
          synonym; reclassify_supabase.py relabels matching postings next run. */}
      <div className="mt-14 flex items-center justify-between">
        <div>
          <h2 className="t-h2">Role requests</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {requestsMigrated
              ? <><span className="tnum">{requests.length}</span> open. Approve → maps the query to a family; a reclassify run relabels postings we already hold.</>
              : <>Table not migrated yet — apply <code className="tnum">migrations/2026-09-role-requests.sql</code> in Supabase.</>}
          </p>
        </div>
      </div>

      {requestsMigrated && (requests.length === 0 ? (
        <Card className="mt-6 text-center text-ink-muted">No role requests yet.</Card>
      ) : (
        <div className="mt-6 space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="font-medium">&ldquo;{r.query}&rdquo; <span className="text-ink-muted">· {r.status}</span></div>
                <div className="tnum mt-1 text-sm text-ink-muted">
                  {r.email} · <span className="text-ink">{(r.matching_n ?? 0).toLocaleString()}</span> postings may match
                  {r.family_assigned ? ` · → ${r.family_assigned}` : ""}
                </div>
              </div>
              {r.status !== "approved" && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <form action={approveRoleRequest.bind(null, r.id, r.query_norm)} className="flex items-center gap-2">
                    <input name="family" placeholder="Family (existing or new)" defaultValue={r.query}
                      className="field w-48 px-2.5 py-1.5 text-sm" />
                    <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ color: "var(--mint)", borderColor: "rgba(74,222,156,.35)", background: "rgba(74,222,156,.08)" }}>Approve</button>
                  </form>
                  <form action={rejectRoleRequest.bind(null, r.id)}>
                    <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ color: "var(--ember)", borderColor: "rgba(255,106,69,.35)", background: "rgba(255,106,69,.08)" }}>Reject</button>
                  </form>
                </div>
              )}
            </Card>
          ))}
        </div>
      ))}

      {/* Near-miss unlock kit — advertised slices at n=5-7; seed submissions to clear. */}
      <div className="mt-14">
        <h2 className="t-h2">Near-miss unlock kit</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Advertised slices sitting at <span className="tnum">5–7</span> salaried — one modest data increase publishes them (gate stays n≥8, unchanged). Seed the exact role + location.
        </p>

        {unlocked.length > 0 && (
          <div className="mt-4 rounded-xl border p-3" style={{ borderColor: "rgba(74,222,156,.35)", background: "rgba(74,222,156,.06)" }}>
            <div className="text-sm font-medium" style={{ color: "var(--mint)" }}>Unlocked by submissions ({unlocked.length})</div>
            <ul className="mt-2 space-y-1 text-sm">
              {unlocked.slice(0, 20).map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <Link href={u.href} className="truncate hover:text-[var(--accent)]">{u.label} <span className="text-ink-faint">· {u.kind}</span></Link>
                  <span className="tnum shrink-0 text-xs text-ink-faint">{u.n} ads + {u.subs} sub = {u.combined}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card mt-4 overflow-hidden !p-0">
          <div className="flex items-center gap-3 border-b px-4 py-2.5 text-[12px] text-ink-faint" style={{ borderColor: "var(--border)" }}>
            <span className="w-6 text-right">#</span><span className="flex-1">Slice (role · location)</span>
            <span className="w-14 text-right">n</span><span className="w-16 text-right">needed</span><span className="w-14 text-right">subs</span>
          </div>
          <ol>
            {nearMiss.map((r, i) => (
              <li key={i} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                <Link href={r.href} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-[var(--band)]">
                  <span className="tnum w-6 text-right text-sm text-ink-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{r.label} <span className="text-ink-faint">· {r.kind}</span></span>
                  <span className="tnum w-14 text-right text-sm">{r.n}</span>
                  <span className="tnum w-16 text-right text-sm font-semibold" style={{ color: "var(--accent)" }}>+{r.needed}</span>
                  <span className="tnum w-14 text-right text-xs text-ink-faint">{r.subs || ""}</span>
                </Link>
              </li>
            ))}
            {nearMiss.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-faint">No slices at n=5–7 right now.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}
