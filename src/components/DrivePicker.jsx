"use client";
// Pick the Google Drive folders a task's work goes into (several if needed, e.g. one per SKU), each with a
// note for the person doing it, and make a new folder right here when it doesn't exist yet.
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { driveFoldersFor, newDriveFolder } from "@/app/(crm)/drive/actions";

const label = (path) => path || "Brand folder";

export default function DrivePicker({ brandId, value, onChange }) {
  const [state, setState] = useState({ loading: false, connected: true, folders: [], error: "" });
  const [making, setMaking] = useState(false);
  const [parent, setParent] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!brandId) return;
    let alive = true;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: "" }));
      const r = await driveFoldersFor(brandId).catch((e) => ({ ok: false, error: e.message }));
      if (!alive) return;
      setState({ loading: false, connected: r.ok ? r.connected : true, folders: r.folders || [], error: r.ok ? "" : r.error });
    })();
    return () => {
      alive = false;
    };
  }, [brandId]);

  if (!brandId) return null;
  if (state.loading) return <p className="text-[12px] text-muted">Loading the brand&apos;s Drive folders…</p>;
  if (!state.connected) return <p className="text-[12px] text-muted">Google Drive isn&apos;t connected yet — admin connects it on the Brands page.</p>;

  const options = state.folders;
  const set = (i, patch) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const add = () => {
    const free = options.find((o) => o.path && !value.some((v) => v.drive_id === o.drive_id));
    if (free) onChange([...value, { drive_id: free.drive_id, path: free.path, note: "" }]);
  };
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const r = await newDriveFolder(brandId, parent, name);
    setBusy(false);
    if (!r.ok) return setState((s) => ({ ...s, error: r.error }));
    setState((s) => ({ ...s, error: "", folders: [...s.folders.filter((f) => f.drive_id !== r.folder.drive_id), r.folder].sort((a, b) => a.path.localeCompare(b.path)) }));
    onChange([...value.filter((v) => v.drive_id !== r.folder.drive_id), { ...r.folder, note: "" }]);
    setName("");
    setMaking(false);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.map((v, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-line p-2.5">
          <div className="flex items-center gap-2">
            <Icon name="board" size={14} className="shrink-0 text-amber-500" />
            <select className="field min-w-0 flex-1 py-1.5 text-[12.5px]" value={v.drive_id} onChange={(e) => set(i, { drive_id: e.target.value, path: options.find((o) => o.drive_id === e.target.value)?.path || "" })}>
              {options.map((o) => (
                <option key={o.drive_id} value={o.drive_id}>
                  {label(o.path)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:text-rose-400" aria-label="Remove folder">
              <Icon name="x" size={13} />
            </button>
          </div>
          <input className="field py-1.5 text-[12.5px]" maxLength={300} value={v.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="What goes here? e.g. Front + back raw photos" />
        </div>
      ))}

      {making ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-brand/50 p-2.5">
          <span className="text-[11.5px] text-muted">New folder inside</span>
          <select className="field py-1.5 text-[12.5px]" value={parent} onChange={(e) => setParent(e.target.value)}>
            {options.map((o) => (
              <option key={o.drive_id} value={o.path}>
                {label(o.path)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input className="field py-1.5 text-[12.5px]" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Folder name, e.g. SKU-102 Rose Tint" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), create())} />
            <button type="button" onClick={create} disabled={busy || !name.trim()} className="btn-primary btn-sm shrink-0">
              {busy ? "Making…" : "Create"}
            </button>
            <button type="button" onClick={() => setMaking(false)} className="btn-ghost btn-sm shrink-0">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={add} disabled={!options.length} className="btn-ghost btn-sm">
            <Icon name="plus" size={12} /> {value.length ? "Add another folder" : "Add a Drive folder"}
          </button>
          <button type="button" onClick={() => setMaking(true)} className="btn-ghost btn-sm">
            <Icon name="board" size={12} /> New folder
          </button>
        </div>
      )}
      {state.error && <p className="text-[12px] text-rose-400">{state.error}</p>}
    </div>
  );
}
