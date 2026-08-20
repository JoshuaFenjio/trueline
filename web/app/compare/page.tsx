import Link from "next/link";
import type { Metadata } from "next";
import { getCompare, getCompaniesBoard, isConfigured } from "@/lib/data";
import { CompareBuilder } from "@/components/CompareBuilder";
import { ShareButton } from "@/components/ShareButton";
import { SectionHeader, Breadcrumbs } from "@/components/blocks";
import { SubNav } from "@/components/SubNav";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Card, ScoreBadge, scoreColor } from "@/components/ui";
import { eur, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

function parseSlugs(sp: { companies?: string }): string[] {
  return (sp.companies || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
}

export async function generateMetadata({ searchParams }: { searchParams: { companies?: string } }): Promise<Metadata> {
  const slugs = parseSlugs(searchParams);
  if (slugs.length < 2) {
    return { title: "Compare companies", description: "Compare tech companies side by side on pay, transparency and role-by-role medians." };
  }
  const cos = await getCompare(slugs);
  const names = cos.map((c) => c.company);
  const title = `${names.join(" vs ")}: who pays more?`;
  const og = `/og?kicker=${encodeURIComponent("Compare · EMEA")}&title=${encodeURIComponent(names.join(" vs "))}&value=${encodeURIComponent("Pay, transparency and role medians")}`;
  return {
    title, // layout template appends " · Trueline"
    description: `${names.join(", ")} compared on Pay Score, median base, transparency and role-by-role pay.`,
    openGraph: { title: `${title} · Trueline`, images: [og] },
    twitter: { card: "summary_large_image", images: [og] },
  };
}

export default async function ComparePage({ searchParams }: { searchParams: { companies?: string } }) {
  if (!isConfigured) return <p className="py-24 text-center text-ink-muted">Supabase not configured.</p>;
  const slugs = parseSlugs(searchParams);
  const [cos, board] = await Promise.all([getCompare(slugs), getCompaniesBoard()]);
  const all = board.map((c) => ({ name: c.company, slug: c.slug }));

  // Shared role rows: any role at least two selected companies disclose.
  const roleCount = new Map<string, number>();
  for (const c of cos) for (const r of Object.keys(c.roleMedians)) roleCount.set(r, (roleCount.get(r) || 0) + 1);
  const roles = [...roleCount.entries()].filter(([, n]) => n >= 2).map(([r]) => r)
    .sort((a, b) => Math.max(...cos.map((c) => c.roleMedians[b] || 0)) - Math.max(...cos.map((c) => c.roleMedians[a] || 0)))
    .slice(0, 10);

  return (
    <div className="py-14">
      <Breadcrumbs items={[{ label: "Companies", href: "/companies" }, { label: "Compare" }]} />
      <div className="mt-4">
        <SubNav items={[
          { label: "Index", href: "/companies" },
          { label: "Compare", href: "/compare" },
          { label: "Transparency", href: "/leaderboards#transparent" },
        ]} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader kicker="Compare" title="Who pays more" />
        {cos.length >= 2 && <ShareButton path={`/compare?companies=${cos.map((c) => c.slug).join(",")}`} />}
      </div>

      <div className="mt-6 max-w-2xl">
        <CompareBuilder all={all} selected={cos.map((c) => c.slug)} />
      </div>

      {cos.length < 2 ? (
        <Card className="mt-8">
          <p className="text-sm text-ink-muted">Add two or three companies above. Popular:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[["monzo", "wise", "gocardless"], ["gitlab", "grafana-labs"], ["deliveroo", "wolt"]].map((set) => {
              const names = set.map((s) => board.find((b) => b.slug === s)?.company).filter(Boolean);
              if (names.length < 2) return null;
              return (
                <Link key={set.join()} href={`/compare?companies=${set.join(",")}`} className="rounded-full border px-3.5 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink" style={{ background: "var(--surface-1)" }}>
                  {names.join(" vs ")}
                </Link>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="mt-8 overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="px-5 py-4 text-left text-xs font-normal text-ink-faint">Metric</th>
                {cos.map((c) => (
                  <th key={c.slug} className="px-5 py-4 text-right">
                    <Link href={`/companies/${c.slug}`} className="inline-flex items-center gap-2 hover:underline">
                      <CompanyLogo name={c.company} size={22} />{c.company}
                    </Link>
                    <div className="text-[11px] font-normal text-ink-faint">{c.sector}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Pay Score">
                {cos.map((c) => (
                  <td key={c.slug} className="px-5 py-3 text-right"><span className="tnum font-semibold" style={{ color: scoreColor(c.payScore) }}>{c.payScore}</span></td>
                ))}
              </Row>
              <Row label="Median base">
                {cos.map((c) => <td key={c.slug} className="px-5 py-3 text-right tnum">{eur(c.midpoint)}</td>)}
              </Row>
              <Row label="Transparency">
                {cos.map((c) => <td key={c.slug} className="px-5 py-3 text-right tnum" style={{ color: c.disclosurePct >= 50 ? "var(--mint)" : undefined }}>{pct(c.disclosurePct)}</td>)}
              </Row>
              <Row label="Sector rank">
                {cos.map((c) => <td key={c.slug} className="px-5 py-3 text-right tnum text-ink-muted">#{c.sectorRank}/{c.sectorTotal}</td>)}
              </Row>
              {roles.length > 0 && (
 <tr><td colSpan={cos.length + 1} className="px-5 pt-5 pb-1 text-[11px] text-ink-faint">Median by role</td></tr>
              )}
              {roles.map((role) => {
                const vals = cos.map((c) => c.roleMedians[role]);
                const best = Math.max(...vals.filter((v) => v));
                return (
                  <Row key={role} label={role}>
                    {cos.map((c, i) => {
                      const v = c.roleMedians[role];
                      return <td key={c.slug} className="px-5 py-3 text-right tnum" style={{ color: v && v === best ? "var(--mint)" : v ? undefined : "var(--ink-faint)" }}>{v ? eur(v) : "—"}</td>;
                    })}
                  </Row>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="px-5 py-3 text-ink-muted">{label}</td>
      {children}
    </tr>
  );
}
