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
            <div className="mb-2.5 text-xs font-medium text-muted">{row.label}</div>
            <div className="flex flex-wrap gap-2">
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
                    className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs transition duration-200 ${
                      active ? "font-medium" : allowed ? "bg-panel-2 text-ink/80 hover:-translate-y-0.5 hover:text-ink" : "cursor-not-allowed bg-panel-2/50 text-faint"
                    }`}
                    style={
                      active
                        ? { background: `color-mix(in srgb, ${s.color} 18%, var(--color-panel))`, color: "var(--color-ink)", boxShadow: `inset 0 0 0 1.5px ${s.color}` }
                        : undefined
                    }
                  >
                    {active ? (
                      <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: s.color }}>
                        <Icon name="check" size={10} />
                      </span>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: allowed ? s.color : "currentColor" }} />
                    )}
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
      <div className={`flex items-center gap-3 rounded-2xl p-3.5 ${owner ? "well" : "tint-amber"}`}>
        {owner ? (
          <Avatar name={owner.name} size={36} />
        ) : (
          <span className="icon-tile h-9 w-9 rounded-full">
            <Icon name="team" size={15} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{owner ? owner.name : "Not assigned yet"}</div>
          <div className="truncate text-xs text-muted">{owner ? "Sales executive" : canAssign ? "Pick an executive below" : "Waiting for the admin"}</div>
        </div>
        {canAssign && owner && (
          <button onClick={() => assign("")} disabled={pending} className="rounded-full bg-panel px-3 py-1.5 text-xs text-muted shadow-[var(--card-shadow)] transition hover:text-rose-400">
            Unassign
          </button>
        )}
      </div>

      {canAssign && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-muted">Sales executives</div>
          {people.length ? (
            <ul className="flex flex-col gap-1">
              {people
                .filter((m) => m.id !== value)
                .map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => assign(m.id)}
                      disabled={pending}
                      className="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition hover:bg-panel-2 disabled:opacity-50"
                    >
                      <Avatar name={m.name} size={30} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink/85">{m.name}</span>
                      <span className="text-[11px] tabular-nums text-faint">{openCounts[m.id] || 0} open</span>
                      <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-medium text-on-brand opacity-0 transition group-hover:opacity-100">Assign</span>
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
      <textarea id={field} rows={rows} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="field min-h-[132px] resize-y leading-relaxed" />
      <div className="mt-2.5 flex h-8 items-center gap-3">
        {dirty && (
          <button type="button" onClick={() => {
              const before = saved;
              setSaved(value);
              save({ [field]: value }, label, () => setSaved(before));
            }} disabled={pending} className="btn-primary btn-sm">
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
