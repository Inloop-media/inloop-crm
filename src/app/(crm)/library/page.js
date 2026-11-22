// Brand library: pick a brand to see its brand identity, images, videos, documents and completed work.
import Link from "next/link";
import Icon from "@/components/Icon";
import { PageTop } from "@/components/Desk";
import { BrandMark, Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { canSeeLibrary } from "@/lib/permissions";
import { libraryBrands } from "@/lib/library";

export const metadata = { title: "Brand library" };

const STAGE = { active: "Active", onboarding: "Onboarding", paused: "Paused", ended: "Ended" };

export default async function LibraryPage({ searchParams }) {
  await requireMember(canSeeLibrary);
  const { q = "" } = await searchParams;
  const all = await libraryBrands();
  const term = String(q).trim().toLowerCase();
  const brands = term ? all.filter((b) => b.name.toLowerCase().includes(term)) : all;
  return (
    <div className="page">
      <PageTop
        title="Brand library"
        sub="Every brand's logos, images, videos and documents from the client, plus the work we've finished for them. Open one to view or download."
        right={
          <form className="flex items-center gap-2">
            <input name="q" defaultValue={q} placeholder="Find a brand" className="field w-56 py-1.5" />
          </form>
        }
      />
      {!brands.length ? (
        <div className="card">
          <Empty icon="brand">{term ? "No brand matches that." : "No brands yet."}</Empty>
        </div>
      ) : (
        <div className="rise grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {brands.map((b) => (
            <Link key={b.id} href={`/library/${b.id}`} className="card card-hover flex items-center gap-3 p-4">
              <BrandMark name={b.name} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{b.name}</span>
                <span className="block text-xs text-muted">
                  {b.files} file{b.files === 1 ? "" : "s"} · {b.completed} done{STAGE[b.stage] && b.stage !== "active" ? ` · ${STAGE[b.stage]}` : ""}
                </span>
              </span>
              <Icon name="arrow" size={14} className="text-faint" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
