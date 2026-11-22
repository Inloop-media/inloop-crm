"use client";
// One brand's library: folders of client material (ops / admin upload; everyone views and downloads)
// and "Completed work" — the final files of every approved task, filled in automatically.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { BrandMark } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { addLibraryItems, createLibraryFolder, deleteLibraryFolder, deleteLibraryItem, libraryUploadUrl, moveLibraryItem, moveLibraryItemToSub } from "@/app/(crm)/library/actions";

const MAX = 50 * 1024 * 1024;
const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const isImg = (f) => /^image\//.test(f.type || "") || /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(f.name || "");
const isVid = (f) => /^video\//.test(f.type || "") || /\.(mp4|mov|webm|m4v)$/i.test(f.name || "");
const ext = (name) => (String(name).includes(".") ? String(name).split(".").pop().slice(0, 4).toUpperCase() : "FILE");
const fmtSize = (n) => (!n ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
// "Brand identity/Logos/x.png" picked with Upload folder → which section a top folder name belongs to
const SECTION_BY_NAME = { "brand identity": "identity", identity: "identity", branding: "identity", images: "images", photos: "images", videos: "videos", video: "videos", documents: "documents", docs: "documents", other: "other" };
const JUNK = /^(\.ds_store|thumbs\.db|desktop\.ini)$|^\._/i;
const joinSub = (...parts) => parts.filter(Boolean).join(" / ");
/** Folders directly inside `at` ("" = the section itself), with how many files sit anywhere under each. */
function childFolders(names, items, at) {
  const prefix = at ? `${at} / ` : "";
  const kids = [];
  for (const n of names) {
    if (at && !n.startsWith(prefix)) continue;
    const rest = at ? n.slice(prefix.length) : n;
    const first = rest.split(" / ")[0];
    if (first && !kids.includes(first)) kids.push(first);
  }
  return kids.map((k) => {
    const full = joinSub(at, k);
    return { name: k, full, count: items.filter((f) => f.subfolder === full || (f.subfolder || "").startsWith(`${full} / `)).length };
  });
}
const KIND = { post: "Static", carousel: "Carousel", reel: "Reel", story: "Story", video: "Video", design: "Design", website: "Website", other: "Other" };

function FileCard({ f, canManage, canDelete = false, folders, onDelete, onMove, onMoveSub, subNames = [], busy }) {
  const link = !f.storage_path;
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <a href={f.href || undefined} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] overflow-hidden bg-panel-2">
        {f.href && isImg(f) ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={f.href} alt={f.name} loading="lazy" className={`h-full w-full transition group-hover:scale-[1.03] ${f.folder === "identity" || /\.(png|svg|webp)$/i.test(f.name || "") ? "object-contain p-4" : "object-cover"}`} />
        ) : f.href && isVid(f) ? (
          <video src={`${f.href}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center">
            <span className={`grid h-14 w-12 place-items-center rounded-lg text-[11px] font-bold text-white ${link ? "bg-sky-500" : /pdf/i.test(ext(f.name)) ? "bg-rose-500" : "bg-brand"}`}>{link ? <Icon name="link" size={18} /> : ext(f.name)}</span>
          </span>
        )}
        {isVid(f) && f.href && (
          <span className="absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white">
            <Icon name="video" size={13} />
          </span>
        )}
      </a>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium" title={f.name}>
            {f.name}
          </div>
          <div className="truncate text-[11px] text-muted">
            {[link ? "Link" : fmtSize(f.size), f.uploader?.name?.split(" ")[0], f.created_at && dateFmt.format(new Date(f.created_at))].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="mt-auto flex items-center gap-1.5">
          <a href={f.download || f.href || undefined} target="_blank" rel="noreferrer" className="btn-ghost btn-sm flex-1 justify-center" download={link ? undefined : f.name}>
            <Icon name={link ? "link" : "download"} size={13} /> {link ? "Open" : "Download"}
          </a>
          {canManage && onMove && (
            <>
              <select aria-label="Move to folder" disabled={busy} value="" onChange={(e) => e.target.value && (e.target.value.startsWith("s:") ? onMoveSub(f, e.target.value.slice(2)) : onMove(f, e.target.value))} className="field w-9 shrink-0 cursor-pointer px-1 py-1.5 text-[11px]" title="Move to another folder">
                <option value="">⇄</option>
                {subNames
                  .filter((n) => n !== (f.subfolder || ""))
                  .map((n) => (
                    <option key={`s:${n}`} value={`s:${n}`}>
                      Into folder: {n}
                    </option>
                  ))}
                {f.subfolder && <option value="s:">Out of the folder</option>}
                {folders
                  .filter((x) => x.id !== f.folder)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      Move to {x.label}
                    </option>
                  ))}
              </select>
            </>
          )}
          {canDelete && onDelete && (
            <button type="button" disabled={busy} onClick={() => onDelete(f)} className="icon-btn h-8 w-8 shrink-0 hover:text-rose-400" aria-label={`Delete ${f.name}`} title="Delete">
              <Icon name="trash" size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibraryView({ brand, assets, subfolders = {}, foldersReady = true, completed, missing, folders, canManage, canDelete = false, initialFolder, locked = [], lockedCount = {}, canOpenLocked = false }) {
  const router = useRouter();
  const [folder, setFolder] = useState(folders.some((f) => f.id === initialFolder) || initialFolder === "completed" ? initialFolder : "identity");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ url: "", name: "" });
  const [pending, start] = useTransition();
  const [sub, setSub] = useState(""); // the folder open inside the section ("" = the section itself)
  const current = folders.find((f) => f.id === folder);
  const all = folder === "completed" ? [] : assets[folder] || [];
  const names = subfolders[folder] || [];
  const kids = childFolders(names, all, sub);
  const items = all.filter((f) => (f.subfolder || "") === sub);
  const doneFiles = completed.reduce((n, c) => n + c.files.length, 0);

  // list: Files, or [{ file, section, subfolder }] from Upload folder
  const upload = async (list) => {
    const files = [...(list || [])]
      .map((x) => (x instanceof File ? { file: x, section: folder, subfolder: sub } : x))
      .filter((x) => x.file.size > 0 && !JUNK.test(x.file.name));
    if (!files.length || folder === "completed") return;
    const big = files.filter((x) => x.file.size > MAX);
    setError(big.length ? `${big.map((x) => x.file.name).join(", ")} ${big.length > 1 ? "are" : "is"} over 50 MB — add ${big.length > 1 ? "them" : "it"} as a Google Drive link instead.` : "");
    const ok = files.filter((x) => x.file.size <= MAX);
    if (!ok.length) return;
    const saved = {}; // section → [{ path, name, size, type, subfolder }]
    try {
      for (const [i, x] of ok.entries()) {
        const f = x.file;
        setBusy(`Uploading ${i + 1} of ${ok.length}…`);
        const u = await libraryUploadUrl(brand.id, x.section, f.name, f.size);
        if (!u.ok) throw new Error(u.error);
        const { error: e } = await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || undefined });
        if (e) throw new Error(e.message);
        (saved[x.section] ||= []).push({ path: u.path, name: f.name, size: f.size, type: f.type, subfolder: x.subfolder });
      }
    } catch (e) {
      setError(e.message || "Upload failed.");
    }
    if (Object.keys(saved).length) {
      setBusy("Saving…");
      for (const [section, rows] of Object.entries(saved)) {
        const r = await addLibraryItems(brand.id, section, rows);
        if (!r.ok) setError(r.error);
      }
      router.refresh();
    }
    setBusy("");
  };

  /**
   * Upload folder: keeps the folders as they are on the computer. Inside a section, the picked folder's
   * sub-folders become folders here ("Logos", "Fonts"…). A whole brand folder with "Brand identity",
   * "Images"… inside goes to those sections.
   */
  const uploadFolder = (list) => {
    const out = [];
    for (const f of [...(list || [])]) {
      const parts = String(f.webkitRelativePath || f.name).split("/").filter(Boolean);
      const top = parts[0] || "";
      const dirs = parts.slice(1, -1);
      let section = folder;
      let path = dirs;
      const routed = dirs.length && SECTION_BY_NAME[dirs[0].toLowerCase()];
      if (routed && !sub) {
        section = routed;
        path = dirs.slice(1);
      }
      // Files straight inside the picked folder go into a folder named after it (when at the section's top)
      const subfolder = path.length ? joinSub(sub, ...path) : sub || (routed ? "" : top);
      out.push({ file: f, section, subfolder });
    }
    upload(out);
  };

  const act = (fn) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else setError("");
      router.refresh();
    });

  const isLocked = locked.includes(folder);
  // Documents are run by the people allowed to open them; the other folders by ops / admin
  const canEdit = folder === "documents" ? canOpenLocked : canManage;
  const tabs = [
    ...folders.map((f) => ({ id: f.id, label: f.label, icon: locked.includes(f.id) ? "lock" : f.icon, count: locked.includes(f.id) ? lockedCount[f.id] || 0 : (assets[f.id] || []).length })),
    { id: "completed", label: "Completed work", icon: "check", count: completed.length },
  ];

  return (
    <div className="page">
      <Link href="/library" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
        <Icon name="chevron" size={12} className="rotate-90" /> Brand library
      </Link>
      <header className="rise mb-5 flex flex-wrap items-center gap-4">
        <BrandMark name={brand.name} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{brand.name}</h1>
          <p className="mt-1 text-[13px] text-muted">
            {Object.values(assets).reduce((n, l) => n + l.length, 0) + Object.values(lockedCount).reduce((n, c) => n + (locked.length ? c : 0), 0)} files from the client · {completed.length} finished pieces ({doneFiles} files)
          </p>
        </div>
      </header>

      {missing && <p className="card mb-4 p-4 text-sm text-muted">The library isn&apos;t set up yet — run migration 020 in Supabase. Completed work below already works.</p>}

      <nav className="rise mb-4 flex max-w-full gap-1 overflow-x-auto rounded-full bg-panel p-1 shadow-[var(--card-shadow)] sm:inline-flex">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setFolder(t.id);
              setSub("");
              setError("");
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 text-[12px] font-medium transition ${folder === t.id ? "bg-solid text-on-solid" : "text-muted hover:text-ink"}`}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
            <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${folder === t.id ? "bg-white/20" : "bg-panel-2 text-muted"}`}>{t.count}</span>
          </button>
        ))}
      </nav>

      {error && <p className="mb-3 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-400">{error}</p>}

      {isLocked ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-panel-2 text-muted">
            <Icon name="lock" size={20} />
          </span>
          <div className="text-[15px] font-medium">{current?.label} are locked</div>
          <p className="max-w-sm text-sm text-muted">
            This folder has confidential files{lockedCount[folder] ? ` (${lockedCount[folder]})` : ""}. Only a few people can open it. Ask your head if you need something from here.
          </p>
        </div>
      ) : folder === "completed" ? (
        completed.length ? (
          <div className="rise flex flex-col gap-4">
            {completed.map(({ task, files }) => (
              <section key={task.id} className="card p-4">
                <header className="mb-3 flex flex-wrap items-center gap-2">
                  <Link href={`/tasks/${task.id}`} className="min-w-0 truncate text-[15px] font-medium hover:text-brand">
                    {task.title}
                  </Link>
                  <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] text-muted">{KIND[task.kind] || task.kind}</span>
                  <span className="ml-auto text-[11px] text-muted">
                    {task.assignee?.name ? `${task.assignee.name.split(" ")[0]} · ` : ""}
                    {task.done_at ? `approved ${dateFmt.format(new Date(task.done_at))}` : "approved"}
                  </span>
                </header>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {files.map((f, i) => (
                    <FileCard key={i} f={f} canManage={false} folders={folders} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="card px-6 py-12 text-center text-sm text-muted">When a task for {brand.name} is approved, its final files show up here.</div>
        )
      ) : (
        <div
          className={`rise rounded-[24px] transition ${drag ? "bg-brand/[0.06] ring-2 ring-brand/40" : ""}`}
          onDragOver={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
          onDrop={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer?.files);
          }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[13px]">
              <button type="button" onClick={() => setSub("")} className={sub ? "text-muted hover:text-ink" : "font-medium"}>
                {current?.label}
              </button>
              {sub &&
                sub.split(" / ").map((part, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <Icon name="chevron" size={12} className="-rotate-90 text-faint" />
                    <button type="button" onClick={() => setSub(arr.slice(0, i + 1).join(" / "))} className={i === arr.length - 1 ? "font-medium" : "text-muted hover:text-ink"}>
                      {part}
                    </button>
                  </span>
                ))}
              {!sub && <span className="ml-2 text-xs text-muted">{current?.hint}</span>}
            </div>
            {canEdit && (
              <>
                {foldersReady && (
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt(sub ? `New folder inside ${sub}:` : `New folder in ${current?.label}:`);
                      if (name?.trim())
                        act(async () => {
                          const r = await createLibraryFolder(brand.id, folder, joinSub(sub, name.trim()));
                          return r;
                        });
                    }}
                    className="btn-ghost btn-sm"
                  >
                    <Icon name="plus" size={13} /> New folder
                  </button>
                )}
                <button type="button" onClick={() => setLinkOpen((v) => !v)} className="btn-ghost btn-sm">
                  <Icon name="link" size={13} /> Add a link
                </button>
                {foldersReady && (
                  <label className={`btn-ghost btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`} title="Pick a folder from your computer — its folders come along">
                    <Icon name="board" size={13} /> Upload folder
                    <input type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={(e) => (uploadFolder(e.target.files), (e.target.value = ""))} />
                  </label>
                )}
                <label className={`btn-primary btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
                  <Icon name="upload" size={13} /> {busy || (sub ? `Upload to ${sub.split(" / ").pop()}` : "Upload files")}
                  <input type="file" multiple className="hidden" onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
                </label>
              </>
            )}
          </div>
          {!foldersReady && canEdit && <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-600">Run migration 026 in Supabase to turn on folders and Upload folder.</p>}
          {kids.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {kids.map((k) => (
                <div key={k.full} className="group relative">
                  <button type="button" onClick={() => setSub(k.full)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel p-3.5 text-left transition hover:border-brand/50 hover:shadow-[var(--card-shadow)]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2.5h7A2.5 2.5 0 0 1 21 9v8.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium">{k.name}</span>
                      <span className="block text-[11.5px] text-muted">{k.count ? `${k.count} file${k.count > 1 ? "s" : ""}` : "Empty"}</span>
                    </span>
                  </button>
                  {canDelete && !k.count && !(current?.presets || []).includes(k.full) && (
                    <button
                      type="button"
                      aria-label={`Delete folder ${k.name}`}
                      onClick={() => confirm(`Delete the empty folder "${k.name}"?`) && act(() => deleteLibraryFolder(brand.id, folder, k.full))}
                      className="absolute right-2 top-2 hidden h-6 w-6 place-items-center rounded-full text-faint hover:bg-panel-2 hover:text-rose-400 group-hover:grid"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {kids.length > 0 && items.length > 0 && !sub && <p className="mb-2 text-xs font-medium text-muted">Not in a folder</p>}
          {linkOpen && canEdit && (
            <form
              className="card mb-3 flex flex-wrap items-center gap-2 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const r = await addLibraryItems(brand.id, folder, [{ ...link, subfolder: sub }]);
                  if (r.ok) {
                    setLink({ url: "", name: "" });
                    setLinkOpen(false);
                  }
                  return r;
                });
              }}
            >
              <input className="field min-w-[220px] flex-[2]" placeholder="https://drive.google.com/…" value={link.url} onChange={(e) => setLink((v) => ({ ...v, url: e.target.value }))} required />
              <input className="field min-w-[160px] flex-1" placeholder="Name (e.g. Raw shoot footage)" value={link.name} onChange={(e) => setLink((v) => ({ ...v, name: e.target.value }))} />
              <button disabled={pending} className="btn-primary btn-sm">
                Add
              </button>
            </form>
          )}
          {items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((f) => (
                <FileCard
                  key={f.id}
                  f={f}
                  canManage={canEdit}
                  canDelete={canDelete && (folder !== "documents" || canOpenLocked)}
                  folders={folders.filter((x) => canOpenLocked || !locked.includes(x.id))}
                  busy={pending}
                  onDelete={(x) => confirm(`Delete "${x.name}" from the library? This can't be undone.`) && act(() => deleteLibraryItem(x.id))}
                  onMove={(x, to) => act(() => moveLibraryItem(x.id, to))}
                  onMoveSub={(x, to) => act(() => moveLibraryItemToSub(x.id, to))}
                  subNames={foldersReady ? names : []}
                />
              ))}
            </div>
          ) : kids.length && !sub ? null : (
            <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted">
              <Icon name={current?.icon || "list"} size={20} />
              {canEdit ? `Nothing in ${sub || current?.label} yet. Drop files here or use Upload files.` : `Nothing in ${sub || current?.label} yet.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
