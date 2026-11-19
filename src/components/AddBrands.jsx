"use client";
// Admin: bring the brands Inloop already works with into the CRM in one go — one row per brand with its
// services and monthly deliverables (posts, carousels, stories, reels, videos). Tasks can then be given per brand.
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { addExistingBrand } from "@/app/(crm)/brands/actions";
import { SERVICES } from "@/lib/constants";

const KINDS = [
  ["post", "Static"],
  ["carousel", "Carousels"],
  ["story", "Stories"],
  ["reel", "Reels"],
  ["video", "Videos"],
];
const blank = () => ({ key: Math.random().toString(36).slice(2), name: "", contact: "", phone: "", services: [], deliverables: {}, state: "", error: "" });
const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

function Row({ r, i, set, remove, busy }) {
  const [more, setMore] = useState(false);
  const done = r.state === "done";
  return (
    <li className={`rounded-2xl border p-3 ${done ? "border-emerald-500/40 bg-emerald-500/5" : r.error ? "border-rose-400/50" : "border-line"}`}>
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-center text-xs text-faint">{i + 1}</span>
        <input className="field flex-1 py-2" placeholder="Brand name *" value={r.name} disabled={busy || done} onChange={(e) => set({ name: e.target.value })} />
        {done ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-400">
            <Icon name="check" size={13} /> Added
          </span>
        ) : (
          <button type="button" disabled={busy} onClick={remove} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint hover:bg-panel-2 hover:text-rose-400" title="Remove row">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5 pl-7">
        {KINDS.map(([k, l]) => (
          <label key={k} className="flex flex-col rounded-xl bg-panel-2 px-2 py-1.5">
            <span className="text-[10.5px] text-muted">{l} / mo</span>
            <input
              type="number"
              min="0"
              max="200"
              inputMode="numeric"
              placeholder="0"
              disabled={busy || done}
              value={r.deliverables[k] || ""}
              onChange={(e) => set({ deliverables: { ...r.deliverables, [k]: e.target.value } })}
              className="w-full bg-transparent text-[15px] font-medium outline-none"
            />
          </label>
        ))}
      </div>
      <div className="mt-2 pl-7">
        <button type="button" onClick={() => setMore(!more)} className="text-[11.5px] text-muted hover:text-ink">
          {more ? "Hide" : "Services & contact"}
          {!more && r.services.length > 0 && <span className="text-faint"> · {r.services.length} services</span>}
        </button>
        {more && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {SERVICES.filter((s) => !s.startsWith("Not sure")).map((s) => {
                const on = r.services.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={busy || done}
                    onClick={() => set({ services: on ? r.services.filter((x) => x !== s) : [...r.services, s] })}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] transition ${on ? "bg-brand/15 text-ink shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "bg-panel-2 text-muted hover:text-ink"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="field py-2 text-[13px]" placeholder="Contact person (optional)" value={r.contact} disabled={busy || done} onChange={(e) => set({ contact: e.target.value })} />
              <input className="field py-2 text-[13px]" placeholder="Phone (optional)" value={r.phone} disabled={busy || done} onChange={(e) => set({ phone: e.target.value })} />
            </div>
          </div>
        )}
      </div>
      {r.error && <p className="mt-1.5 pl-7 text-xs text-rose-400">{r.error}</p>}
    </li>
  );
}

export default function AddBrands() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => [blank(), blank(), blank()]);
  const [month, setMonth] = useState(thisMonth);
  const [busy, setBusy] = useState(false);
  const setRow = (key, patch) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const todo = rows.filter((r) => r.state !== "done" && r.name.trim());
  const added = rows.filter((r) => r.state === "done").length;

  const addAll = async () => {
    setBusy(true);
    for (const r of todo) {
      const res = await addExistingBrand({ name: r.name, contact: r.contact, phone: r.phone, services: r.services, deliverables: r.deliverables, month });
      setRow(r.key, res.ok ? { state: "done", error: "" } : { error: res.error });
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm">
        <Icon name="plus" size={13} /> Add existing brands
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <button aria-label="Close" onClick={() => !busy && setOpen(false)} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
            <div className="pop relative flex max-h-[92dvh] w-full max-w-2xl flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-medium">Add existing brands</h2>
                  <p className="text-xs text-muted">For brands you already handle — they go straight to Active (no MOU), with their monthly deliverables, so you can give tasks for them.</p>
                </div>
                <label className="flex shrink-0 flex-col text-[10.5px] text-muted">
                  Deliverables from
                  <input type="month" className="field mt-0.5 py-1 text-[12.5px]" value={month} onChange={(e) => setMonth(e.target.value)} disabled={busy} />
                </label>
              </div>
              <ul className="-mx-1 mt-4 flex flex-1 flex-col gap-2 overflow-y-auto px-1">
                {rows.map((r, i) => (
                  <Row key={r.key} r={r} i={i} busy={busy} set={(p) => setRow(r.key, { ...p, error: "" })} remove={() => setRows(rows.length > 1 ? rows.filter((x) => x.key !== r.key) : [blank()])} />
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <button type="button" disabled={busy} onClick={() => setRows([...rows, blank()])} className="btn-ghost btn-sm">
                  <Icon name="plus" size={13} /> Another brand
                </button>
                <span className="flex-1 text-xs text-muted">{added ? `${added} added` : ""}</span>
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn-ghost btn-sm">
                  {added && !todo.length ? "Done" : "Cancel"}
                </button>
                <button type="button" disabled={busy || !todo.length} onClick={addAll} className="btn-primary btn-sm">
                  {busy ? "Adding…" : `Add ${todo.length || ""} brand${todo.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
