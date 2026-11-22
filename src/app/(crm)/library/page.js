// Brand library in the Overview's bold style: a hero with the files we hold, a black card for the latest
// upload, then a card per brand — a preview window (logo on a plate / photo / hatched placeholder), the
// folders that have something in them, and a round arrow. Open one to view or download.
import Link from "next/link";
import Icon from "@/components/Icon";
import { FilterPills } from "@/components/Desk";
import { DARK, HatchBar, RoundLink, Tile } from "@/components/Bold";
import { BrandMark, Empty } from "@/components/ui";
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

/** The preview window: the brand's logo on a white plate, a photo, or a hatched placeholder with its mark. */
function Preview({ b, dark }) {
  const logo = b.covers.find((x) => x.logo);
  const photo = b.covers.find((x) => !x.logo);
  if (logo)
    return (
      <div className="grid h-full place-items-center bg-white p-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
        <img src={logo.src} alt={b.name} className="h-full max-h-[96px] w-full object-contain" />
      </div>
    );
  if (photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
      <img src={photo.src} alt="" className="h-full w-full object-cover" />
    );
  return (
    <div className={`grid h-full place-items-center ${dark ? "bg-white/5" : "hatch"}`}>
      <span className="rounded-[18px] bg-panel p-1 shadow-[var(--card-shadow)]">
        <BrandMark name={b.name} size={44} />
      </span>
    </div>
  );
}

function BrandCard({ b }) {
  const filled = FOLDERS.filter(([id]) => b.folders[id]);
  return (
    <Link href={`/library/${b.id}`} className="group card flex flex-col p-3 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-22px_rgb(0_0_0/0.3)]">
      <div className="relative h-36 overflow-hidden rounded-[18px] border border-line">
        <div className="h-full transition duration-700 ease-out group-hover:scale-[1.04]">
          <Preview b={b} />
        </div>
        {STAGE[b.stage] && <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-medium text-white">{STAGE[b.stage]}</span>}
        {b.files > 0 && <span className="absolute right-2.5 top-2.5 rounded-full bg-solid px-2.5 py-1 text-[10.5px] font-medium tabular-nums text-on-solid">{b.files} files</span>}
      </div>
      <div className="flex flex-1 flex-col px-2 pb-1 pt-3.5">
        <div className="flex items-center gap-2.5">
          <BrandMark name={b.name} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium tracking-[-0.01em]">{b.name}</span>
            <span className="block truncate text-[11px] text-muted">{b.updated ? `Updated ${ago(b.updated)}` : "Nothing uploaded yet"}</span>
          </span>
          <RoundLink as="span" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filled.map(([id, icon, label]) => (
            <span key={id} className="flex items-center gap-1.5 rounded-full bg-panel-2 py-1 pl-1 pr-2.5 text-[11px] text-muted">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-panel text-brand shadow-[var(--card-shadow)]">
                <Icon name={icon} size={10} />
              </span>
              <b className="font-medium tabular-nums text-ink">{b.folders[id]}</b> {label}
            </span>
          ))}
          {b.completed > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 py-1 pl-1 pr-2.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-panel shadow-[var(--card-shadow)]">
                <Icon name="check" size={10} />
              </span>
              <b className="font-medium tabular-nums">{b.completed}</b> finished
            </span>
          )}
          {!filled.length && !b.completed && <span className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[11px] text-faint">Empty — add the brand kit</span>}
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
  const total = (f) => all.reduce((n, b) => n + (b.folders[f] || 0), 0);
  const totalFiles = all.reduce((n, b) => n + b.files, 0);
  const totalDone = all.reduce((n, b) => n + b.completed, 0);
  const stocked = all.filter((b) => b.files).length;
  const stockedPct = all.length ? Math.round((stocked / all.length) * 100) : 0;
  const latest = [...all].filter((b) => b.updated).sort((a, b) => b.updated.localeCompare(a.updated))[0];

  return (
    <div className="page">
      <header className="rise mb-5 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em]">Brand library</h1>
        <form className="relative w-full sm:w-72">
          <Icon name="search" size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          {show && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={q} placeholder="Find a brand" className="field !rounded-full py-2 !pl-9" />
        </form>
      </header>

      {!term && !show && (
        <div className="rise mb-6 grid gap-4 xl:grid-cols-12">
          {/* Hero */}
          <section className="card p-5 xl:col-span-8">
            <div>
              <p className="text-xs text-muted">Logos, photos, videos and documents from clients</p>
              <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
                Every brand kit <span className="text-brand">in one place</span>
              </h2>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">{totalFiles}</span>
              <span className="mb-1.5 text-sm text-muted">files saved</span>
              <span className="mb-2 rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                {stocked} of {all.length} brands have files
              </span>
            </div>
            <div className="relative mt-8">
              <HatchBar pct={stockedPct} />
              <span className="absolute -top-7 right-[3%] flex flex-col items-center">
                <span className="rounded-md bg-solid px-1.5 py-0.5 text-[10px] font-medium text-on-solid">All {all.length} brands</span>
                <span className="h-6 w-px bg-ink" />
              </span>
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              <Tile icon="brand" label="Brand identity" value={total("identity")} note="logos, fonts, guidelines" />
              <Tile icon="board" label="Images & videos" value={total("images") + total("videos")} note="shoots, references, footage" />
              <Tile icon="check" label="Finished work" value={totalDone} note="approved pieces we made" />
            </div>
          </section>

          {/* Latest upload */}
          <section className={`flex flex-col p-5 xl:col-span-4 ${DARK}`}>
            {latest ? (
              <>
                <div className="flex items-start justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-white/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Latest upload · {ago(latest.updated)}
                  </span>
                  <RoundLink href={`/library/${latest.id}`} label={`Open ${latest.name}`} light />
                </div>
                <h2 className="mt-3 text-[26px] font-normal leading-tight tracking-[-0.02em]">{latest.name}</h2>
                <p className="text-[12px] text-white/60">
                  {latest.files} file{latest.files === 1 ? "" : "s"} in the library
                </p>
                <div className="mt-4 h-32 overflow-hidden rounded-[18px]">
                  <Preview b={latest} dark />
                </div>
                <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
                  {FOLDERS.slice(0, 3).map(([id, , label]) => (
                    <span key={id} className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-[11px] text-white/60">
                      {label}
                      <b className="text-[13px] font-medium tabular-nums text-white">{latest.folders[id] || 0}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="my-auto text-center text-[13px] text-white/70">Nothing uploaded yet. Open a brand and add its logo, fonts and photos.</div>
            )}
          </section>
        </div>
      )}

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
