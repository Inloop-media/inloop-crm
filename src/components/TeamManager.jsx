"use client";

import { useActionState, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { addGuest, addMember, createGroup, updateGroup, updateGuest, updateMember } from "@/app/(crm)/actions";
import { GROUP_KINDS, ROLES, UPDATE_EVENTS } from "@/lib/constants";

const KIND_TONE = {
  sales: "tint-blue text-ink",
  strategy: "tint-pink text-ink",
  other: "tint-lavender text-ink",
};

function useChange(fn) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const change = (...args) =>
    start(async () => {
      const res = await fn(...args);
      setError(res.ok ? "" : res.error);
    });
  return { pending, error, change };
}

/* ------------------------------ People ------------------------------ */

function MemberRow({ m, isMe, groups }) {
  const { pending, error, change } = useChange(updateMember);
  const mine = m.groups.map((g) => g.id);
  const toggle = (gid) => change(m.id, { groups: mine.includes(gid) ? mine.filter((x) => x !== gid) : [...mine, gid] });

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-4 py-3.5 transition hover:bg-panel-2 ${m.active ? "" : "opacity-50"}`}>
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
        <Avatar name={m.name} size={40} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {m.name} {isMe && <span className="text-xs font-normal text-muted">(you)</span>}
          </div>
          <div className="truncate text-xs text-muted">
            {m.email}
            <span className={m.calendar_connected_at ? "text-emerald-400" : "text-faint"}>
              {" · "}
              {m.calendar_connected_at ? "Calendar connected" : "Calendar not connected"}
            </span>
          </div>
          {error && <div className="mt-1 text-xs text-rose-400">{error}</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const on = mine.includes(g.id);
          return (
            <button
              key={g.id}
              disabled={pending}
              onClick={() => toggle(g.id)}
              title={on ? `Remove from ${g.name}` : `Add to ${g.name}`}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${on ? KIND_TONE[g.kind] : "border border-dashed border-line-strong text-faint hover:text-ink"}`}
            >
              {on ? "✓ " : "+ "}
              {g.name}
            </button>
          );
        })}
      </div>
      <select value={m.role} disabled={pending || isMe} onChange={(e) => change(m.id, { role: e.target.value })} className="field w-auto rounded-full py-2 text-xs">
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {!isMe && (
        <button disabled={pending} onClick={() => change(m.id, { active: !m.active })} className="rounded-full px-3 py-1.5 text-xs text-muted transition hover:bg-panel hover:text-rose-400">
          {m.active ? "Remove access" : "Restore"}
        </button>
      )}
    </li>
  );
}

function AddPerson({ groups }) {
  const [state, action, pending] = useActionState(addMember, {});
  return (
    <form action={action} key={state?.message} className="card grid gap-4 p-6 lg:grid-cols-[1fr_1fr_170px]">
      <div className="flex items-center gap-3 lg:col-span-3">
        <span className="icon-tile h-9 w-9"><Icon name="plus" size={15} /></span>
        <div className="font-medium">Add a person</div>
      </div>
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" required className="field" placeholder="Aryan Verma" />
      </div>
      <div>
        <label className="label" htmlFor="email">Google account email</label>
        <input id="email" name="email" type="email" required className="field" placeholder="name@inloopmedia.com" />
      </div>
      <div>
        <label className="label" htmlFor="role">Access</label>
        <select id="role" name="role" defaultValue="member" className="field">
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-3">
        <span className="label">Groups</span>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-full bg-panel-2 px-3.5 py-2 text-sm transition has-[:checked]:bg-tint-lavender has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--color-brand)]">
              <input type="checkbox" name="groups" value={g.id} className="accent-[var(--color-brand)]" />
              {g.name}
            </label>
          ))}
          {!groups.length && <span className="text-sm text-muted">Create a group below first.</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
        <button disabled={pending} className="btn-primary">
          <Icon name="plus" size={14} /> {pending ? "Adding…" : "Add person"}
        </button>
        {(state?.error || state?.message) && <p className={`text-sm ${state.error ? "text-rose-400" : "text-emerald-400"}`}>{state.error || state.message}</p>}
      </div>
    </form>
  );
}

/* ------------------------------ Groups ------------------------------ */

function GroupCard({ g, members }) {
  const { pending, error, change } = useChange(updateGroup);
  const kind = GROUP_KINDS.find((k) => k.id === g.kind);
  const outside = members.filter((m) => m.active && !g.members.some((x) => x.id === m.id));

  return (
    <div className="card card-hover flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-medium">{g.name}</div>
          <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${KIND_TONE[g.kind]}`}>{kind?.label}</span>
        </div>
        <button
          disabled={pending}
          onClick={() => confirm(`Delete the group "${g.name}"? People stay on the team.`) && change(g.id, { delete: true })}
          title="Delete group"
          className="icon-btn h-8 w-8 hover:text-rose-400"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{kind?.help}</p>
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium text-muted">Posts here</div>
        <div className="flex flex-wrap gap-1.5">
          {UPDATE_EVENTS.map((e) => {
            const on = (g.notify || []).includes(e.id);
            return (
              <button
                key={e.id}
                disabled={pending}
                onClick={() => change(g.id, { notify: on ? g.notify.filter((x) => x !== e.id) : [...(g.notify || []), e.id] })}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  on ? "solid" : "border border-dashed border-line-strong text-faint hover:text-ink"
                }`}
              >
                <Icon name={e.icon} size={11} />
                {e.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-1.5 mt-5 text-xs font-medium text-muted">Members</div>
      <ul className="flex flex-1 flex-col gap-1.5">
        {g.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-sm transition hover:bg-panel-2">
            <Avatar name={m.name} size={24} />
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            <button disabled={pending} onClick={() => change(g.id, { removeMember: m.id })} title="Remove from group" className="grid h-6 w-6 place-items-center rounded-full text-faint hover:bg-panel hover:text-rose-400">
              <Icon name="x" size={13} />
            </button>
          </li>
        ))}
        {!g.members.length && <li className="text-xs text-faint">No one yet.</li>}
      </ul>
      {outside.length > 0 && (
        <select
          value=""
          disabled={pending}
          onChange={(e) => e.target.value && change(g.id, { addMember: e.target.value })}
          className="field mt-4 rounded-full py-2 text-xs"
        >
          <option value="">+ Add someone…</option>
          {outside.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function NewGroup() {
  const [state, action, pending] = useActionState(createGroup, {});
  return (
    <form action={action} key={state?.message} className="well-empty flex flex-col gap-3 bg-panel/40 p-6">
      <div className="flex items-center gap-3">
        <span className="icon-tile h-9 w-9"><Icon name="plus" size={15} /></span>
        <div className="text-lg font-medium">New group</div>
      </div>
      <input name="name" required placeholder="e.g. Performance Team" className="field bg-panel" />
      <select name="kind" defaultValue="other" className="field bg-panel">
        {GROUP_KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            Works like: {k.label}
          </option>
        ))}
      </select>
      <div>
        <div className="mb-2 text-xs font-medium text-muted">Posts here</div>
        <div className="flex flex-col gap-1.5">
          {UPDATE_EVENTS.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink/80">
              <input type="checkbox" name="notify" value={e.id} className="accent-[var(--color-brand)]" />
              {e.label}
            </label>
          ))}
        </div>
      </div>
      <button disabled={pending} className="btn-primary">
        <Icon name="plus" size={14} /> {pending ? "Creating…" : "Create group"}
      </button>
      {(state?.error || state?.message) && <p className={`text-xs ${state.error ? "text-rose-400" : "text-emerald-400"}`}>{state.error || state.message}</p>}
    </form>
  );
}

/* --------------------------- Meeting guests --------------------------- */

function GuestRow({ g }) {
  const { pending, error, change } = useChange(updateGuest);
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3 transition hover:bg-panel-2 ${g.active ? "" : "opacity-50"}`}>
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <Avatar name={g.name} size={36} />
        <div className="min-w-0">
          <div className="truncate text-sm">{g.name}</div>
          <div className="truncate text-xs text-muted">{g.email}</div>
          {error && <div className="mt-1 text-xs text-rose-400">{error}</div>}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={g.is_default}
          disabled={pending || !g.active}
          onChange={(e) => change(g.id, { is_default: e.target.checked })}
          className="accent-[var(--color-brand)]"
        />
        Pre-selected
      </label>
      <button disabled={pending} onClick={() => change(g.id, { active: !g.active })} className="rounded-full px-3 py-1.5 text-xs text-muted transition hover:bg-panel hover:text-rose-400">
        {g.active ? "Remove" : "Restore"}
      </button>
    </li>
  );
}

function GuestsSection({ guests }) {
  const [state, action, pending] = useActionState(addGuest, {});
  return (
    <section id="guests" className="flex scroll-mt-6 flex-col gap-4">
      <div>
        <h2 className="text-2xl font-medium tracking-tight">Meeting guests</h2>
        <p className="text-sm text-muted">
          Who executives can add to a discovery call. They pick by name; the invite goes to these emails. &quot;Pre-selected&quot; people are ticked by default.
        </p>
      </div>
      <form action={action} key={state?.message} className="card grid gap-3 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="guest-name">Name</label>
          <input id="guest-name" name="name" required className="field" placeholder="Ananya" />
        </div>
        <div>
          <label className="label" htmlFor="guest-email">Email</label>
          <input id="guest-email" name="email" type="email" required className="field" placeholder="name@inloopmedia.com" />
        </div>
        <button disabled={pending} className="btn-primary">
          <Icon name="plus" size={14} /> {pending ? "Adding…" : "Add guest"}
        </button>
        {(state?.error || state?.message) && (
          <p className={`text-sm sm:col-span-3 ${state.error ? "text-rose-400" : "text-emerald-400"}`}>{state.error || state.message}</p>
        )}
      </form>
      {guests.length > 0 && (
        <ul className="card flex flex-col gap-0.5 p-2">
          {guests.map((g) => (
            <GuestRow key={g.id} g={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TeamManager({ members, groups, guests = [], meId }) {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">People</h2>
          <p className="text-sm text-muted">Only people listed here can sign in. Click a group chip to add or remove someone.</p>
        </div>
        <AddPerson groups={groups} />
        <ul className="card flex flex-col gap-0.5 p-2">
          {members.map((m) => (
            <MemberRow key={m.id} m={m} isMe={m.id === meId} groups={groups} />
          ))}
        </ul>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.id} className="well p-5">
              <dt className="font-medium">{r.label}</dt>
              <dd className="mt-1 text-muted">{r.help}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="groups" className="flex scroll-mt-6 flex-col gap-4">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">Groups</h2>
          <p className="text-sm text-muted">
            What a member can do comes from their groups. &quot;Posts here&quot; picks which bot updates show up in the group&apos;s feed under Updates.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <GroupCard key={g.id} g={g} members={members} />
          ))}
          <NewGroup />
        </div>
      </section>

      <GuestsSection guests={guests} />
    </div>
  );
}
