"use client";

import { useActionState, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { addGuest, addMember, createGroup, updateGroup, updateGuest, updateMember } from "@/app/(crm)/actions";
import { GROUP_KINDS, ROLES, UPDATE_EVENTS } from "@/lib/constants";

const KIND_TONE = {
  sales: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  strategy: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
  other: "border-line bg-panel-2 text-white/70",
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
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 ${m.active ? "" : "opacity-50"}`}>
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
        <Avatar name={m.name} size={34} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {m.name} {isMe && <span className="text-xs font-normal text-muted">(you)</span>}
          </div>
          <div className="truncate text-xs text-muted">
            {m.email}
            <span className={m.calendar_connected_at ? "text-emerald-400/80" : "text-faint"}>
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
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${on ? KIND_TONE[g.kind] : "border-dashed border-line text-faint hover:border-line-strong hover:text-white"}`}
            >
              {on ? "✓ " : "+ "}
              {g.name}
            </button>
          );
        })}
      </div>
      <select value={m.role} disabled={pending || isMe} onChange={(e) => change(m.id, { role: e.target.value })} className="field w-auto py-1.5 text-xs">
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {!isMe && (
        <button disabled={pending} onClick={() => change(m.id, { active: !m.active })} className="text-xs text-muted hover:text-rose-300">
          {m.active ? "Remove access" : "Restore"}
        </button>
      )}
    </li>
  );
}

function AddPerson({ groups }) {
  const [state, action, pending] = useActionState(addMember, {});
  return (
    <form action={action} key={state?.message} className="card grid gap-4 p-5 lg:grid-cols-[1fr_1fr_150px]">
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
            <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand/50 has-[:checked]:bg-brand/10">
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
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{g.name}</div>
          <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[11px] ${KIND_TONE[g.kind]}`}>{kind?.label}</span>
        </div>
        <button
          disabled={pending}
          onClick={() => confirm(`Delete the group "${g.name}"? People stay on the team.`) && change(g.id, { delete: true })}
          title="Delete group"
          className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-panel-2 hover:text-rose-300"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{kind?.help}</p>
      <div className="mt-4">
        <div className="eyebrow mb-2">Posts here</div>
        <div className="flex flex-wrap gap-1.5">
          {UPDATE_EVENTS.map((e) => {
            const on = (g.notify || []).includes(e.id);
            return (
              <button
                key={e.id}
                disabled={pending}
                onClick={() => change(g.id, { notify: on ? g.notify.filter((x) => x !== e.id) : [...(g.notify || []), e.id] })}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  on ? "border-brand/40 bg-brand/10 text-brand" : "border-dashed border-line text-faint hover:border-line-strong hover:text-white"
                }`}
              >
                <Icon name={e.icon} size={11} />
                {e.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="eyebrow mb-1 mt-5">Members</div>
      <ul className="flex flex-1 flex-col gap-1.5">
        {g.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm">
            <Avatar name={m.name} size={24} />
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            <button disabled={pending} onClick={() => change(g.id, { removeMember: m.id })} title="Remove from group" className="text-faint hover:text-rose-300">
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
          className="field mt-4 py-1.5 text-xs"
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
    <form action={action} key={state?.message} className="card flex flex-col gap-3 border-dashed p-5">
      <div className="font-medium">New group</div>
      <input name="name" required placeholder="e.g. Performance Team" className="field" />
      <select name="kind" defaultValue="other" className="field">
        {GROUP_KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            Works like: {k.label}
          </option>
        ))}
      </select>
      <div>
        <div className="eyebrow mb-2">Posts here</div>
        <div className="flex flex-col gap-1.5">
          {UPDATE_EVENTS.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="notify" value={e.id} className="accent-[var(--color-brand)]" />
              {e.label}
            </label>
          ))}
        </div>
      </div>
      <button disabled={pending} className="btn-ghost">
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
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${g.active ? "" : "opacity-50"}`}>
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <Avatar name={g.name} size={28} />
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
      <button disabled={pending} onClick={() => change(g.id, { active: !g.active })} className="text-xs text-muted hover:text-rose-300">
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
        <h2 className="text-lg font-semibold tracking-tight">Meeting guests</h2>
        <p className="text-sm text-muted">
          Who executives can add to a discovery call. They pick by name; the invite goes to these emails. &quot;Pre-selected&quot; people are ticked by default.
        </p>
      </div>
      <form action={action} key={state?.message} className="card grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
        <ul className="card divide-y divide-line overflow-hidden">
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
          <h2 className="text-lg font-semibold tracking-tight">People</h2>
          <p className="text-sm text-muted">Only people listed here can sign in. Click a group chip to add or remove someone.</p>
        </div>
        <AddPerson groups={groups} />
        <ul className="card divide-y divide-line overflow-hidden">
          {members.map((m) => (
            <MemberRow key={m.id} m={m} isMe={m.id === meId} groups={groups} />
          ))}
        </ul>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <dt className="font-medium">{r.label}</dt>
              <dd className="mt-1 text-muted">{r.help}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="groups" className="flex scroll-mt-6 flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Groups</h2>
          <p className="text-sm text-muted">
            What a member can do comes from their groups. &quot;Posts here&quot; picks which bot updates show up in the group&apos;s feed under Updates.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
