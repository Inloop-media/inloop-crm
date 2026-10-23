"use client";

import { useState, useTransition } from "react";
import { STATUSES } from "@/lib/constants";
import { updateLead } from "@/app/(crm)/actions";

function useSaver(id) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const save = (patch, label, onFail) =>
    start(async () => {
      const res = await updateLead(id, patch);
      setMsg(res.ok ? { ok: true, text: `${label} saved` } : { ok: false, text: res.error });
      if (res.ok) setTimeout(() => setMsg(null), 2500);
      else onFail?.();
    });
  return { pending, msg, save };
}

/** A select that saves on change and snaps back if the save is refused. */
function SavingSelect({ id, field, label, initial, children, saver }) {
  const [value, setValue] = useState(initial);
  return (
    <select
      id={field}
      value={value}
      onChange={(e) => {
        const before = value;
        setValue(e.target.value);
        saver.save({ [field]: e.target.value }, label, () => setValue(before));
      }}
      disabled={saver.pending}
      className="field"
    >
      {children}
    </select>
  );
}

function Note({ id, field, label, initial, placeholder }) {
  const [value, setValue] = useState(initial || "");
  const { pending, msg, save } = useSaver(id);
  const dirty = value !== (initial || "");
  return (
    <div>
      <label className="label" htmlFor={field}>
        {label}
      </label>
      <textarea id={field} rows={4} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="field resize-y" />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => save({ [field]: value }, label)} disabled={!dirty || pending} className="btn-ghost">
          {pending ? "Saving…" : `Save ${label.toLowerCase()}`}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export default function LeadEditor({ lead, members, canAssign }) {
  const status = useSaver(lead.id);
  const owner = useSaver(lead.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <SavingSelect id={lead.id} field="status" label="Status" initial={lead.status} saver={status}>
            {STATUSES.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </SavingSelect>
          {status.msg && <p className={`mt-1.5 text-xs ${status.msg.ok ? "text-emerald-400" : "text-red-400"}`}>{status.msg.text}</p>}
        </div>
        <div>
          <label className="label" htmlFor="assigned_to">
            Assigned to
          </label>
          {canAssign ? (
            <SavingSelect id={lead.id} field="assigned_to" label="Owner" initial={lead.assigned_to || ""} saver={owner}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </SavingSelect>
          ) : (
            <div className="field text-muted">{members.find((m) => m.id === lead.assigned_to)?.name || "Unassigned"}</div>
          )}
          {owner.msg && <p className={`mt-1.5 text-xs ${owner.msg.ok ? "text-emerald-400" : "text-red-400"}`}>{owner.msg.text}</p>}
        </div>
      </div>
      <Note id={lead.id} field="remarks" label="Remarks" initial={lead.remarks} placeholder="Call notes, follow-ups, anything the team should know…" />
      <Note id={lead.id} field="brief" label="Brief" initial={lead.brief} placeholder="What the client needs — shared with Ops when the brief is handed over." />
    </div>
  );
}
