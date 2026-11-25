"use client";
// Who runs a group and who is in it: the CBO it comes under, its managers (any number),
// its team leads (people in the group, any number) and its members. Used on the Team page and on a
// group's own page (by the CBO it comes under).
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { updateGroup } from "@/app/(crm)/actions";
import { ownHeadIds, teamLeadIdsOf } from "@/lib/groups";

function Chip({ name, onRemove, disabled, tone = "" }) {
  return (
    <span className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 text-[12.5px] ${tone || "bg-panel"}`}>
      <Avatar name={name} size={20} />
      <span className="max-w-[140px] truncate">{name}</span>
      {onRemove && (
        <button type="button" disabled={disabled} onClick={onRemove} title="Remove" className="grid h-5 w-5 place-items-center rounded-full text-faint hover:bg-panel-2 hover:text-rose-400">
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  );
}

function AddSelect({ label, options, onPick, disabled }) {
  if (!options.length) return null;
  return (
    <select value="" disabled={disabled} onChange={(e) => e.target.value && onPick(e.target.value)} className="rounded-full border border-dashed border-line-strong bg-transparent py-1 pl-2.5 pr-7 [background-position:right_0.55rem_center] text-[12px] text-muted outline-none hover:text-ink">
      <option value="">{label}</option>
      {options.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

/**
 * group: the groups row (head_ids, team_lead_ids, owner_id…)
 * members: people in the group [{ id, name, active }]
 * everyone: active people who could be managers or be added [{ id, name }]
 * opsHeads: CBOs a group can come under [{ id, name }]
 * admin: may change which CBO it comes under
 */
export default function GroupPeople({ group, members, everyone, opsHeads = [], admin = false, showMembers = true }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const change = (patch) =>
    start(async () => {
      const r = await updateGroup(group.id, patch);
      setError(r.ok ? "" : r.error);
    });
  const name = Object.fromEntries([...everyone, ...members, ...opsHeads].map((m) => [m.id, m.name]));
  const heads = ownHeadIds(group);
  const leads = teamLeadIdsOf(group);
  const active = members.filter((m) => m.active !== false);
  const inGroup = new Set(active.map((m) => m.id));
  const ops = group.kind === "execution";
  const owner = group.owner_id ? name[group.owner_id] : "";

  return (
    <div className="flex flex-col gap-3">
      {ops ? (
        <div className="flex items-center gap-3 rounded-2xl bg-panel-2 px-3 py-2.5">
          <span className="text-xs font-medium text-muted">Comes under</span>
          <span className="text-sm">Admin</span>
        </div>
      ) : (
        <div className="rounded-2xl bg-panel-2 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted">Comes under</span>
            {admin ? (
              <select value={group.owner_id || ""} disabled={pending} onChange={(e) => change({ owner_id: e.target.value || null })} className="min-w-0 flex-1 bg-transparent pr-7 text-sm outline-none [background-position:right_0.2rem_center]">
                <option value="">Admin</option>
                {opsHeads.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm">{owner || "Admin"}</span>
            )}
          </div>
          {admin && !opsHeads.length && <p className="mt-1 text-[11px] text-faint">Make the CBO group and add the CBOs first.</p>}
        </div>
      )}

      <div className="rounded-2xl bg-panel-2 px-3 py-2.5">
        <div className="mb-2 text-xs font-medium text-muted">{ops ? "CBOs" : "Managers"}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {heads.map((id) => (
            <Chip key={id} name={name[id] || "Someone"} disabled={pending} onRemove={() => change({ head_ids: heads.filter((x) => x !== id) })} />
          ))}
          {!heads.length && <span className="text-[12.5px] text-faint">{owner ? `None —  (CBO) manages it` : "No manager yet"}</span>}
          <AddSelect label={ops ? "+ Add CBO" : "+ Add manager"} disabled={pending} options={everyone.filter((m) => !heads.includes(m.id))} onPick={(id) => change({ head_ids: [...heads, id] })} />
        </div>
      </div>

      {!ops && (
        <div className="rounded-2xl bg-panel-2 px-3 py-2.5">
          <div className="mb-2 text-xs font-medium text-muted">Team leads</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {leads.map((id) => (
              <Chip key={id} name={name[id] || "Someone"} tone="bg-brand/12" disabled={pending} onRemove={() => change({ team_lead_ids: leads.filter((x) => x !== id) })} />
            ))}
            {!leads.length && <span className="text-[12.5px] text-faint">No team lead</span>}
            <AddSelect label="+ Add team lead" disabled={pending} options={active.filter((m) => !leads.includes(m.id))} onPick={(id) => change({ team_lead_ids: [...leads, id] })} />
          </div>
          {!active.length && <p className="mt-1.5 text-[11px] text-faint">Add people to the group first — a team lead is someone in it.</p>}
        </div>
      )}

      {showMembers && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">Members · {active.length}</div>
          <ul className="flex flex-col gap-1">
            {active.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-sm transition hover:bg-panel-2">
                <Avatar name={m.name} size={24} />
                <span className="min-w-0 flex-1 truncate">
                  {m.name}
                  {heads.includes(m.id) && <span className="ml-1.5 rounded-full bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">{ops ? "CBO" : "Manager"}</span>}
                  {leads.includes(m.id) && <span className="ml-1.5 rounded-full bg-brand/12 px-1.5 py-0.5 text-[10px] font-medium text-brand">Team lead</span>}
                </span>
                <button type="button" disabled={pending} onClick={() => change({ removeMember: m.id })} title="Remove from group" className="grid h-6 w-6 place-items-center rounded-full text-faint hover:bg-panel hover:text-rose-400">
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
            {!active.length && <li className="text-xs text-faint">No one yet.</li>}
          </ul>
          <div className="mt-2">
            <AddSelect label="+ Add someone…" disabled={pending} options={everyone.filter((m) => !inGroup.has(m.id))} onPick={(id) => change({ addMember: id })} />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
