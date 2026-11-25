"use client";
// Brand assets: company profiles, presentations and past work for pitching. Sales open or download
// them; admin and the sales head add or remove them.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/browser";
import { addAsset, assetUploadUrl, deleteAsset } from "@/app/(crm)/assets/actions";

const KINDS = [
  ["profile", "Company profiles", "brief"],
  ["presentation", "Presentations", "board"],
  ["work", "Past work", "sparkle"],
  ["client", "Client documents", "list"],
  ["other", "Other", "file"],
];
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n ? `${Math.max(1, Math.round(n / 1024))} KB` : "");

function AddAsset() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", kind: "profile", note: "", url: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      let up = {};
      if (file) {
        setBusy("Uploading…");
        const u = await assetUploadUrl(file.name, file.size);
        if (!u.ok) throw new Error(u.error);
        const { error: upErr } = await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || undefined });
        if (upErr) throw new Error(upErr.message);
        up = { path: u.path, fileName: file.name, size: file.size };
      }
      setBusy("Saving…");
      const r = await addAsset({ ...f, title: f.title || file?.name || "", ...up });
      if (!r.ok) throw new Error(r.error);
      setOpen(false);
      setF({ title: "", kind: f.kind, note: "", url: "" });
      setFile(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm">
        <Icon name="plus" size={13} /> Add asset
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <button aria-label="Close" onClick={() => !busy && setOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
            <form onSubmit={save} className="pop relative flex w-full max-w-md flex-col gap-4 p-6">
              <h2 className="text-[16px] font-medium">Add a brand asset</h2>
              <div>
                <label className="label">What is it</label>
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.map(([id, l]) => (
                    <button key={id} type="button" onClick={() => setF((v) => ({ ...v, kind: id }))} className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ${f.kind === id ? "solid" : "bg-panel-2 text-muted"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="as-title">Name</label>
                <input id="as-title" className="field" placeholder="Inloop company profile 2026" value={f.title} onChange={set("title")} />
              </div>
              <div>
                <label className="label">File</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-panel-2 file:px-3 file:py-1.5 file:text-[12.5px]" />
                <p className="mt-1.5 text-[11.5px] text-muted">PDF, deck, image or video — up to 100 MB. Or paste a link instead:</p>
                <input className="field mt-1.5" placeholder="https://drive.google.com/…  or a Behance / website link" value={f.url} onChange={set("url")} disabled={!!file} />
              </div>
              <div>
                <label className="label" htmlFor="as-note">Note (optional)</label>
                <input id="as-note" className="field" placeholder="Use this for D2C brands" value={f.note} onChange={set("note")} />
              </div>
              {error && <p className="text-[13px] text-rose-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={!!busy} className="btn-ghost btn-sm">
                  Cancel
                </button>
                <button disabled={!!busy || (!file && !f.url.trim())} className="btn-primary btn-sm">
                  {busy || "Add"}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}

export default function AssetsBoard({ assets, canManage }) {
  const router = useRouter();
  const [kind, setKind] = useState("");
  const shown = kind ? assets.filter((a) => a.kind === kind) : assets;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="inline-flex items-center gap-1 rounded-full bg-panel p-1 shadow-[var(--card-shadow)]">
          {[["", "All"], ...KINDS].map(([id, l]) => (
            <button key={id} type="button" onClick={() => setKind(id)} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${kind === id ? "bg-solid text-on-solid" : "text-muted hover:text-ink"}`}>
              {l}
              <span className="ml-1 opacity-60">{id ? assets.filter((a) => a.kind === id).length : assets.length}</span>
            </button>
          ))}
        </nav>
        <span className="flex-1" />
        {canManage && <AddAsset />}
      </div>
      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => {
            const k = KINDS.find(([id]) => id === a.kind) || KINDS[KINDS.length - 1];
            return (
              <div key={a.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                    <Icon name={k[2]} size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium">{a.title}</p>
                    <p className="truncate text-[12px] text-muted">{[k[1], a.storage_path ? kb(a.size) : "Link"].filter(Boolean).join(" · ")}</p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={async () => {
                        if (!confirm(`Remove "${a.title}"?`)) return;
                        await deleteAsset(a.id);
                        router.refresh();
                      }}
                      className="text-faint hover:text-rose-400"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
                {a.note && <p className="text-[12.5px] text-muted">{a.note}</p>}
                <div className="mt-auto flex gap-2">
                  <a href={a.href} target="_blank" rel="noreferrer" className="btn-primary btn-sm flex-1 justify-center">
                    <Icon name="external" size={13} /> Open
                  </a>
                  {a.storage_path && (
                    <a href={`${a.href}${a.href.includes("?") ? "&" : "?"}download=${encodeURIComponent(a.file_name || a.title)}`} className="btn-ghost btn-sm flex-1 justify-center">
                      <Icon name="download" size={13} /> Download
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="card p-8 text-center text-[13px] text-muted">{assets.length ? "Nothing in this section yet." : canManage ? "Add your company profile, decks and best work here — the sales team pitches with these." : "Nothing here yet. Ask the sales head to add the company profile and decks."}</p>
      )}
    </div>
  );
}
