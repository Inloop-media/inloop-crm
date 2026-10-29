"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import Icon from "@/components/Icon";
import { EXEC_STATUSES, STATUSES } from "@/lib/constants";
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

const Msg = ({ msg }) => (msg ? <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p> : null);

/**
 * Status as pills in two rows: the sales stages (executives can use these) and the proposal & close
 * stages (admin / ops only). Saves on click and snaps back if the save is refused.
 */
export function StatusPicker({ lead, statuses }) {
  const [value, setValue] = useState(lead.status);
  const { pending, msg, save } = useSaver(lead.id);
  const locked = !statuses.includes(lead.status);
  const pick = (name) => {
    if (name === value) return;
    const before = value;
    setValue(name);
    save({ status: name }, "Status", () => setValue(before));
  };
  const rows = [
    { label: "Sales", items: STATUSES.filter((s) => EXEC_STATUSES.includes(s.name)) },
    { label: "Proposal & close", items: STATUSES.filter((s) => !EXEC_STATUSES.includes(s.name)) },
  ];

  return (
    <div>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="eyebrow mb-2">{row.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {row.items.map((s) => {
                const active = s.name === value;
                const allowed = statuses.includes(s.name) && !locked;
                return (
                  <button
                    key={s.name}
                    type="button"
                    disabled={pending || !allowed}
                    onClick={() => pick(s.name)}
                    title={!allowed && !active ? "Admin only" : s.help || s.name}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                      active
                        ? "font-medium text-black"
                        : allowed
                          ? "border-line text-ink/80 hover:border-line-strong hover:bg-ink/[0.03]"
                          : "cursor-not-allowed border-line/60 text-faint"
                    }`}
                    style={active ? { background: s.color, borderColor: s.color } : undefined}
                  >
                    {!active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: allowed ? s.color : "currentColor" }} />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {locked && !msg && <p className="mt-3 text-xs text-muted">The admin handles the status from here.</p>}
      <Msg msg={msg} />
    </div>
  );
}

/** Who owns the lead: the current owner up top, the sales executives below to pick from. */
export function OwnerPicker({ lead, members, assignees, canAssign, openCounts = {} }) {
  const [value, setValue] = useState(lead.assigned_to || "");
  const { pending, msg, save } = useSaver(lead.id);
  // Keep the current owner listed even if they've since left the sales group
  const people = assignees.some((m) => m.id === lead.assigned_to) ? assignees : [...assignees, ...members.filter((m) => m.id === lead.assigned_to)];
  const owner = people.find((m) => m.id === value);
  const assign = (id) => {
    if (id === value) return;
    const before = value;
    setValue(id);
    save({ assigned_to: id || null }, id ? "Owner" : "Unassigned", () => setValue(before));
  };

  return (
    <div>
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${owner ? "border-ink/[0.08] bg-ink/[0.02]" : "border-dashed border-amber-400/30 bg-amber-400/[0.04]"}`}>
        {owner ? (
          <Avatar name={owner.name} size={36} />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-amber-400/40 text-amber-300">
            <Icon name="team" size={15} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{owner ? owner.name : "Not assigned yet"}</div>
          <div className="truncate text-xs text-muted">{owner ? "Sales executive" : canAssign ? "Pick an executive below" : "Waiting for the admin"}</div>
        </div>
        {canAssign && owner && (
          <button onClick={() => assign("")} disabled={pending} className="text-xs text-muted hover:text-rose-300">
            Unassign
          </button>
        )}
      </div>

      {canAssign && (
        <div className="mt-3">
          {people.length ? (
            <ul className="flex flex-col gap-1">
              {people
                .filter((m) => m.id !== value)
                .map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => assign(m.id)}
                      disabled={pending}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/[0.04] disabled:opacity-50"
                    >
                      <Avatar name={m.name} size={26} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink/85">{m.name}</span>
                      <span className="text-[11px] tabular-nums text-faint">{openCounts[m.id] || 0} open</span>
                      <span className="text-xs text-brand opacity-0 transition group-hover:opacity-100">Assign</span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Add people to the Sales Executives group under Team to assign leads.</p>
          )}
        </div>
      )}
      <Msg msg={msg} />
    </div>
  );
}

function Note({ id, field, label, initial, placeholder, rows = 4 }) {
  const [value, setValue] = useState(initial || "");
  const [saved, setSaved] = useState(initial || "");
  const { pending, msg, save } = useSaver(id);
  const dirty = value !== saved;
  return (
    <div>
      <label className="label" htmlFor={field}>
        {label}
      </label>
      <textarea id={field} rows={rows} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="field resize-y leading-relaxed" />
      <div className="mt-2 flex h-8 items-center gap-3">
        {dirty && (
          <button type="button" onClick={() => {
              const before = saved;
              setSaved(value);
              save({ [field]: value }, label, () => setSaved(before));
            }} disabled={pending} className="btn-primary px-3 py-1.5 text-xs">
            {pending ? "Saving…" : `Save ${label.toLowerCase()}`}
          </button>
        )}
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function Notes({ lead }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Note id={lead.id} field="remarks" label="Remarks" initial={lead.remarks} placeholder="Call notes, follow-ups, anything the team should know…" />
      <Note
        id={lead.id}
        field="brief"
        label="Client brief"
        initial={lead.brief}
        placeholder="What the client needs — goes to the creative strategists when the proposal meeting is booked."
      />
    </div>
  );
}
