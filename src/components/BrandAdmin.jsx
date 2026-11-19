"use client";
// Admin on a brand's page: edit its name, services and contact, or delete it (type the name to confirm).
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { deleteBrand, updateBrand } from "@/app/(crm)/brands/actions";
import { SERVICES } from "@/lib/constants";

export default function BrandAdmin({ brand }) {
  const router = useRouter();
  const lead = brand.lead || {};
  const start = () => ({
    name: brand.name,
    contact: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
    phone: lead.phone || "",
    email: lead.email || "",
    services: (brand.services || []).map((s) => s.name),
  });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [del, setDel] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const options = [...new Set([...SERVICES.filter((s) => !s.startsWith("Not sure")), ...f.services])];

  const close = () => {
    if (busy) return;
    setOpen(false);
    setDel(false);
    setConfirmName("");
    setError("");
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await updateBrand(brand.id, f).catch((err) => ({ ok: false, error: err?.message || "Couldn't save — reload the page and try again." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    const r = await deleteBrand(brand.id, confirmName).catch((err) => ({ ok: false, error: err?.message || "Couldn't delete — reload the page and try again." }));
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    router.push("/brands");
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setF(start());
          setOpen(true);
        }}
        className="btn-ghost btn-sm"
      >
        <Icon name="brief" size={13} /> Edit
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
            <form onSubmit={save} className="pop relative flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-5">
              <div>
                <h2 className="text-[15px] font-medium">Edit {brand.name}</h2>
                <p className="text-xs text-muted">Monthly deliverables are changed from the brand&apos;s Calendar tab.</p>
              </div>
              <div>
                <label className="label" htmlFor="be-name">Brand name *</label>
                <input id="be-name" className="field" required value={f.name} onChange={set("name")} disabled={busy} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="be-contact">Contact person</label>
                  <input id="be-contact" className="field" value={f.contact} onChange={set("contact")} disabled={busy} />
                </div>
                <div>
                  <label className="label" htmlFor="be-phone">Phone</label>
                  <input id="be-phone" className="field" value={f.phone} onChange={set("phone")} disabled={busy} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="be-email">Email</label>
                <input id="be-email" type="email" className="field" value={f.email} onChange={set("email")} disabled={busy} />
              </div>
              <div>
                <span className="label">Services</span>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((s) => {
                    const on = f.services.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => setF((v) => ({ ...v, services: on ? v.services.filter((x) => x !== s) : [...v.services, s] }))}
                        className={`rounded-full px-2.5 py-1 text-[11.5px] transition ${on ? "bg-brand/15 text-ink shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "bg-panel-2 text-muted hover:text-ink"}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && !del && <p className="text-xs text-rose-400">{error}</p>}

              <div className="flex items-center justify-between gap-2">
                <button type="button" disabled={busy} onClick={() => setDel(!del)} className="flex items-center gap-1.5 text-xs text-rose-400 hover:underline">
                  <Icon name="trash" size={13} /> Delete brand
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={close} disabled={busy} className="btn-ghost btn-sm">
                    Cancel
                  </button>
                  <button disabled={busy} className="btn-primary btn-sm">
                    {busy && !del ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              {del && (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/5 p-4">
                  <p className="text-sm font-medium text-rose-400">Delete {brand.name} for good?</p>
                  <p className="mt-1 text-xs text-muted">Its tasks, content calendar, client chat, library and client login are deleted too. This can&apos;t be undone.</p>
                  <label className="label mt-3" htmlFor="be-confirm">
                    Type <span className="font-medium text-ink">{brand.name}</span> to confirm
                  </label>
                  <input id="be-confirm" className="field" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} disabled={busy} autoComplete="off" />
                  {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy || confirmName.trim().toLowerCase() !== brand.name.trim().toLowerCase()}
                    className="btn-sm mt-3 w-full rounded-full bg-rose-500 py-2 text-sm font-medium text-white transition hover:bg-rose-600 disabled:opacity-40"
                  >
                    {busy ? "Deleting…" : "Delete brand"}
                  </button>
                </div>
              )}
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
