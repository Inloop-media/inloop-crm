// Brand library: every brand as a card with a cover (its latest photos, or its colour), what each folder
// holds, and when something was last added. Open one to view or download.
import Link from "next/link";
import Icon from "@/components/Icon";
import { FilterPills } from "@/components/Desk";
import { BrandMark, Empty, tint } from "@/components/ui";
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
];

/** The top of a card: up to three of the brand's photos, or a soft wash of its colour with its letter. */
function Cover({ b }) {
  const c = tint(b.name);
  if (b.covers.length) {
    const [a, ...rest] = b.covers;
    return (
      <div className={`grid h-full gap-1 ${rest.length ? "grid-cols-[2fr_1fr]" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
        <img src={a} alt="" className="h-full w-full object-cover" loading="lazy" />
        {rest.length > 0 && (
          <div className="grid gap-1">
            {rest.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img key={src} src={src} alt="" className="h-full min-h-0 w-full object-cover" loading="lazy" />
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className="grid h-full place-items-center overflow-hidden"
      style={{
        background: `radial-gradient(120% 90% at 15% 0%, color-mix(in srgb, ${c} 30%, transparent), transparent 60%), radial-gradient(90% 80% at 100% 100%, color-mix(in srgb, ${c} 20%, transparent), transparent 65%), var(--color-panel-2)`,
      }}
    >
      <span className="select-none text-[64px] font-semibold leading-none tracking-[-0.04em]" style={{ color: `color-mix(in srgb, ${c} 40%, transparent)` }}>
        {String(b.name).trim()[0]?.toUpperCase()}
      </span>
    </div>
  );
}

function BrandCard({ b }) {
  return (
    <Link href={`/library/${b.id}`} className="group card card-hover flex flex-col overflow-hidden !p-0">
      <div className="relative h-36 overflow-hidden">
        <div className="h-full transition duration-500 group-hover:scale-[1.03]">
          <Cover b={b} />
        </div>
        {STAGE[b.stage] && <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">{STAGE[b.stage]}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <div className="relative -mt-6 flex items-end gap-3">
          <span className="rounded-[15px] bg-panel p-1 shadow-[var(--card-shadow)]">
            <BrandMark name={b.name} size={42} />
          </span>
          <span className="min-w-0 flex-1 truncate pb-1 text-[15px] font-medium group-hover:text-brand">{b.name}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {FOLDERS.map(([id, icon, label]) => {
            const n = b.folders[id] || 0;
            return (
              <span key={id} title={label} className={`flex flex-col items-center gap-0.5 rounded-xl bg-panel-2 py-2 text-center ${n ? "" : "opacity-50"}`}>
                <Icon name={icon} size={13} className="text-muted" />
                <span className="text-[13px] font-medium tabular-nums">{n}</span>
                <span className="text-[10px] text-muted">{label}</span>
              </span>
            );
          })}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-[12px] text-muted">
          <span className="truncate">
            {b.completed ? `${b.completed} finished piece${b.completed === 1 ? "" : "s"}` : "No finished work yet"}
            {b.updated ? ` · added ${ago(b.updated)}` : ""}
          </span>
          <span className="flex shrink-0 items-center gap-1 font-medium text-ink opacity-0 transition group-hover:opacity-100">
            Open <Icon name="arrow" size={12} />
          </span>
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
        <div className="rise grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {brands.map((b) => (
            <BrandCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
