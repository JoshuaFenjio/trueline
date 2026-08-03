import { isAdmin, getServiceClient, adminConfigured } from "@/lib/admin";
import { login, logout, setStatus } from "./actions";
import { Card, PrimaryButton } from "@/components/ui";
import { eur } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

export default async function Admin({ searchParams }: { searchParams: { error?: string } }) {
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
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-ink-muted">Review submitted salaries.</p>
        {searchParams.error && (
          <p className="mt-4 text-sm" style={{ color: "var(--ember)" }}>Wrong password.</p>
        )}
        <form action={login} className="mt-6 space-y-3">
          <input
            name="password" type="password" placeholder="Admin password" autoFocus
            className="field w-full px-3 py-3"
          />
          <PrimaryButton className="w-full">Sign in</PrimaryButton>
        </form>
      </div>
    );
  }

  const sb = getServiceClient();
  const { data } = sb
    ? await sb.from("submissions").select("*").eq("status", "pending").order("created_at", { ascending: false })
    : { data: [] as any[] };
  const rows = (data as any[]) || [];

  return (
    <div className="mx-auto max-w-4xl py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Submission review</h1>
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
    </div>
  );
}
