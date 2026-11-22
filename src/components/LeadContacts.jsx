"use client";
// Extra phone numbers / emails on a lead. The client sometimes gives a different number or email than
// the one on the form — add it here; the original stays as it is.
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { addLeadContact, removeLeadContact } from "@/app/(crm)/actions";

export default function LeadContacts({ leadId, contacts = [], canRemove = false }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("phone");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = (e) => {
    e.preventDefault();
    start(async () => {
      const r = await addLeadContact(leadId, type, value, label);
      if (!r.ok) return setError(r.error);
      setValue("");
      setLabel("");
      setError("");
      setOpen(false);
    });
  };

  return (
    <div className="well p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">Other numbers &amp; emails</span>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
            <Icon name="plus" size={12} /> Add number or email
          </button>
        )}
      </div>
      {contacts.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {contacts.map((c) => {
            const href = c.type === "email" ? `mailto:${c.value}` : `tel:${c.value.replace(/[^\d+]/g, "")}`;
            return (
              <li key={c.value} className="flex items-center gap-2.5 text-sm">
                <Icon name={c.type === "email" ? "mail" : "phone"} size={14} className="text-muted" />
                <a href={href} className="font-medium hover:text-brand">
                  {c.value}
                </a>
                {c.label && <span className="text-xs text-muted">· {c.label}</span>}
                <span className="text-[11px] text-faint">added by {String(c.by || "").split(" ")[0]}</span>
                {canRemove && (
                  <button type="button" onClick={() => start(() => removeLeadContact(leadId, c.value))} className="ml-auto text-faint hover:text-rose-400" aria-label="Remove">
                    <Icon name="x" size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!contacts.length && !open && <p className="mt-1 text-[12.5px] text-faint">None yet.</p>}
      {open && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select value={type} onChange={(e) => setType(e.target.value)} className="field bg-panel sm:w-32">
            <option value="phone">Phone</option>
            <option value="email">Email</option>
          </select>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type={type === "email" ? "email" : "tel"}
            placeholder={type === "email" ? "name@theirbrand.com" : "+91 98765 43210"}
            className="field bg-panel"
          />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Whose? (optional)" className="field bg-panel sm:w-44" />
          <div className="flex gap-2">
            <button disabled={pending || !value.trim()} className="btn-primary btn-sm">
              {pending ? "Adding…" : "Add"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-[12px] text-rose-400">{error}</p>}
    </div>
  );
}
