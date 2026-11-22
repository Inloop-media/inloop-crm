// Brand library: every brand as a card with a cover (its latest photos, or its colour), what each folder
// holds, and when something was last added. Open one to view or download.
import Link from "next/link";
import Icon from "@/components/Icon";
import { FilterPills } from "@/components/Desk";
import { BrandMark, Empty, brandBackdrop } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { canSeeLibrary } from "@/lib/permissions";
import { libraryBrands } from "@/lib/library";
import { ago } from "@/lib/format";

export const metadata = { title: "Brand library" };

const STAGE = { onboarding: "Onboarding", paused: "Paused", ended: "Ended" };
const FOLDERS = [
  ["identity", "brand", "Identity"],
  ["images", "board", "Images"],
  ["videos", "video", "Videos"],
  ["documents", "brief", "Docs"],
  ["other", "list", "Other"],
];

/**
 * The top of a card. A logo sits whole on a white plate; photos fill the cover; a brand with nothing
 * uploaded gets its mark on a glass tile.
 */
function Cover({ b }) {
  const logo = b.covers.find((x) => x.logo);
  const photo = b.covers.find((x) => !x.logo);
  if (photo && !logo)
    return (
      <div className="relative h-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
        <img src={photo.src} alt="" className="h-full w-full object-cover" loading="lazy" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
      </div>
    );
  return (
    <div className="grid h-full place-items-center" style={brandBackdrop(b.name)}>
      {logo ? (
        <span className="grid h-[88px] w-[62%] place-items-center rounded-2xl bg-white px-5 py-3 shadow-[0_8px_24px_-10px_rgb(0_0_0/0.25),0_0_0_1px_rgb(0_0_0/0.04)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
          <img src={logo.src} alt={b.name} className="h-full w-full object-contain" loading="lazy" />
        </span>
      ) : (
        <span className="rounded-[22px] bg-white/60 p-1.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.3)] ring-1 ring-white/70 backdrop-blur dark:bg-white/10 dark:ring-white/10">
          <BrandMark name={b.name} size={56} />
        </span>
      )}
    </div>
  );
}

function BrandCard({ b }) {
  const filled = FOLDERS.filter(([id]) => b.folders[id]);
  return (
    <Link
      href={`/library/${b.id}`}
      className="group card flex flex-col overflow-hidden !p-0 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgb(0_0_0/0.35)]"
    >
      <div className="relative h-40 overflow-hidden border-b border-line">
        <div className="h-full transition duration-700 ease-out group-hover:scale-[1.04]">
          <Cover b={b} />
        </div>
        {STAGE[b.stage] && <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">{STAGE[b.stage]}</span>}
        {b.files > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-panel/85 px-2.5 py-1 text-[11px] font-medium tabular-nums shadow-sm backdrop-blur">
            {b.files} file{b.files === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium tracking-[-0.01em]">{b.name}</span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-muted transition group-hover:border-transparent group-hover:bg-solid group-hover:text-on-solid">
            <Icon name="arrow" size={12} className="-rotate-45" />
          </span>
        </div>
        <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          {filled.length ? (
            filled.map(([id, icon, label]) => (
              <span key={id} className="flex items-center gap-1">
                <Icon name={icon} size={12} className="text-faint" />
                <b className="font-medium tabular-nums text-ink">{b.folders[id]}</b> {label}
              </span>
            ))
          ) : (
            <span className="text-faint">Nothing uploaded yet</span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-[11.5px] text-faint">
          <span>{b.completed ? `${b.completed} finished piece${b.completed === 1 ? "" : "s"}` : "No finished work yet"}</span>
          {b.updated && <span>Updated {ago(b.updated)}</span>}
        </div>
      </div>
    </Link>
  );
}

export default async function LibraryPage({ searchParams }) {
  await requireMember(canSeeLibrary);
  const sp = await searchParams;
  const q = String(sp.q || "");
  const show = ["files", "empty"].includes(sp.show) ? sp.show : "";
  const all = await libraryBrands();
  const term = q.trim().toLowerCase();
  const found = term ? all.filter((b) => b.name.toLowerCase().includes(term)) : all;
  const withFiles = found.filter((b) => b.files).sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  const empty = found.filter((b) => !b.files);
  // Brands with material first (most recently added on top), the empty ones after, A–Z
  const brands = show === "files" ? withFiles : show === "empty" ? empty : [...withFiles, ...empty];
  const href = (o) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(show && { show }), ...o });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return p.toString() ? `/library?${p}` : "/library";
  };
  const totalFiles = all.reduce((n, b) => n + b.files, 0);
  const totalDone = all.reduce((n, b) => n + b.completed, 0);

  return (
    <div className="page">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em]">Brand library</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            <span className="text-ink">{all.length}</span> brands · <span className="text-ink">{totalFiles}</span> files from clients · <span className="text-ink">{totalDone}</span> finished pieces
          </p>
        </div>
        <form className="relative w-full sm:w-72">
          <Icon name="search" size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          {show && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={q} placeholder="Find a brand" className="field !rounded-full py-2 !pl-9" />
        </form>
      </header>

      <FilterPills
        className="rise mb-5"
        items={[
          { label: "All", count: found.length, href: href({ show: "" }), on: !show },
          { label: "Has files", count: withFiles.length, href: href({ show: "files" }), on: show === "files" },
          { label: "Nothing yet", count: empty.length, href: href({ show: "empty" }), on: show === "empty" },
        ]}
      />

      {!brands.length ? (
        <div className="card">
          <Empty icon="brand">{term ? "No brand matches that." : show === "files" ? "No brand has files yet." : "No brands here."}</Empty>
        </div>
      ) : (
        <div className="rise grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {brands.map((b) => (
            <BrandCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
