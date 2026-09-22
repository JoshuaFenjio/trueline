import Link from "next/link";
import type { CommunityEntry } from "@/lib/data";
import { Flag } from "@/components/Flag";
import { Icon } from "@/components/icons";
import { familyLabel } from "@/lib/roleNames";
import { eurK, slugify, timeAgoMs } from "@/lib/format";

/**
 * "Recently added by the community" — approved submissions only.
 *
 * Renders NOTHING when the caller passes an empty list, which is what
 * getCommunityActivity returns below the 3-entry gate. Pay is a 5k band, not
 * the figure someone sent: a role, a level, a city and an exact salary together
 * identify a person, and every contributor was promised otherwise.
 */
export function CommunityActivity({
  entries, title = "Recently added by the community", showCompany = true, className = "",
}: {
  entries: CommunityEntry[];
  title?: string;
  showCompany?: boolean;
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <section className={className}>
      <div className="card !p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <span className="icon-chip"><Icon.users size={15} /></span>
            <span className="text-[15px] font-semibold">{title}</span>
          </div>
          <span className="text-[11px] text-ink-faint">Human-reviewed · shown as a band, never an exact figure</span>
        </div>
        <ul>
          {entries.map((e, i) => (
            <li key={i} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-start gap-3 px-4 py-3 sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">
                    <Link href={`/roles/${slugify(e.role)}`} className="hover:text-[var(--accent)]">{familyLabel(e.role)}</Link>
                    {e.level && <span className="ml-2 text-[12px] font-normal text-ink-muted">{e.level}</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint">
                    {showCompany && e.company && <span className="truncate">{e.company}</span>}
                    {e.city && (
                      <span className="flex items-center gap-1.5">
                        {showCompany && e.company && <span className="text-ink-faint/50">·</span>}
                        <Flag country={e.country} /><span>{e.city}</span>
                      </span>
                    )}
                    {e.addedMs > 0 && <><span className="text-ink-faint/50">·</span><span className="tnum">{timeAgoMs(e.addedMs)}</span></>}
                  </div>
                </div>
                <span className="tnum shrink-0 text-right text-[13px] font-semibold">
                  {eurK(e.bandLo)}–{eurK(e.bandHi)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/add" className="arrow-link flex items-center justify-center gap-1 border-t px-4 py-2.5 text-xs" style={{ borderColor: "var(--border)" }}>
          Add yours <span className="arw">→</span>
        </Link>
      </div>
    </section>
  );
}
