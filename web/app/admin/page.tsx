import { isAdmin, getServiceClient, adminConfigured } from "@/lib/admin";
import { login, logout, setStatus, approveRoleRequest, rejectRoleRequest } from "./actions";
import { Card, PrimaryButton } from "@/components/ui";
import { eur } from "@/lib/format";

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

  return (
    <div className="mx-auto max-w-4xl py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="t-h2">Submission review</h1>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="tnum">{rows.length}</span> pending. Approved rows flow into stats as verified (shown at 3+ per slice).
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
                <div className="tnum mt-1 text-sm text-ink-muted">
                  {eur(r.base_eur)} base
                  {r.city ? ` · ${r.city}` : ""}{r.country ? `, ${r.country}` : ""}
                  {r.proof_type ? ` · ${r.proof_type}` : ""}
                </div>
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
    </div>
  );
}
