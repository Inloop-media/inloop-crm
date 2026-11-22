"use client";
// Team & groups (admin): three tabs — People, Groups, Meeting guests — so nothing is one long scroll.
//   People   one slim row each: who, their groups (only the ones they're in), Documents, access, remove.
//            "Groups" on a row opens a small list to tick groups on / off. "Add person" opens a popup.
//   Groups   compact cards (people, team leads, what posts there); "New group" opens a popup.
//   Guests   who executives can add to a discovery call.
// The tab follows the URL hash (#groups, #guests), so /team#groups from the Groups page lands right.
import { useActionState, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import GroupPeople from "@/components/GroupPeople";
import { addGuest, addMember, createGroup, updateGroup, updateGuest, updateMember } from "@/app/(crm)/actions";
import { operationsHeadIds, sortGroups } from "@/lib/groups";
import { GROUP_KINDS, ROLES, UPDATE_EVENTS } from "@/lib/constants";

const KIND_TONE = {
  sales: "tint-blue text-ink",
  strategy: "tint-pink text-ink",
  execution: "tint-amber text-ink",
  design: "tint-green text-ink",
  video: "tint-lavender text-ink",
  development: "tint-blue text-ink",
  performance: "tint-amber text-ink",
  social: "tint-pink text-ink",
  production: "tint-green text-ink",
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

/** The current URL hash, kept in step with the address bar. */
const onHash = (cb) => (window.addEventListener("hashchange", cb), () => window.removeEventListener("hashchange", cb));
const useHash = () =>
  useSyncExternalStore(
    onHash,
    () => window.location.hash,
    () => ""
  );

/** A centred popup (bottom sheet on phones). */
function Popup({ title, onClose, children, width = 560 }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <div className="pop relative flex max-h-[92svh] w-full flex-col overflow-hidden !rounded-b-none sm:!rounded-3xl" style={{ maxWidth: width }}>
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[16px] font-medium">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-panel-2" aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------ People ------------------------------ */

function GroupChip({ g }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${KIND_TONE[g.kind] || KIND_TONE.other}`}>{g.name}</span>;
}

function MemberRow({ m, isMe, groups }) {
  const { pending, error, change } = useChange(updateMember);
  const [picking, setPicking] = useState(false);
  const mine = m.groups.map((g) => g.id);
  const theirs = groups.filter((g) => mine.includes(g.id));
  const toggle = (gid) => change(m.id, { groups: mine.includes(gid) ? mine.filter((x) => x !== gid) : [...mine, gid] });

  return (
    <li className={`grid items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] ${m.active ? "" : "opacity-50"}`}>
      {/* Who */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative shrink-0">
          <Avatar name={m.name} size={36} />
          <span
            title={m.calendar_connected_at ? "Calendar connected" : "Calendar not connected"}
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-panel)] ${m.calendar_connected_at ? "bg-emerald-400" : "bg-panel-3"}`}
          />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">
            {m.name} {isMe && <span className="text-xs font-normal text-muted">(you)</span>}
            {!m.active && <span className="ml-1 text-[11px] font-normal text-rose-400">No access</span>}
          </div>
          <div className="truncate text-[11.5px] text-muted">
            {m.email}
            <span className={m.calendar_connected_at ? "text-emerald-500" : "text-faint"}> · {m.calendar_connected_at ? "Calendar connected" : "Calendar not connected"}</span>
          </div>
          {error && <div className="mt-0.5 text-[11px] text-rose-400">{error}</div>}
        </div>
      </div>

      {/* Groups they're in + the picker */}
      <div className="relative flex min-w-0 flex-wrap items-center gap-1.5">
        {theirs.map((g) => (
          <GroupChip key={g.id} g={g} />
        ))}
        {!theirs.length && <span className="text-[12px] text-faint">No group</span>}
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className={`flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-[11px] font-medium transition ${picking ? "border-ink text-ink" : "border-line-strong text-muted hover:text-ink"}`}
        >
          <Icon name="plus" size={10} /> Groups
        </button>
        {picking && (
          <>
            <button aria-label="Close" className="fixed inset-0 z-20 cursor-default" onClick={() => setPicking(false)} />
            <div className="pop absolute left-0 top-full z-30 mt-2 w-64 p-1.5">
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-muted">Tick to add, untick to remove</p>
              {groups.map((g) => {
                const on = mine.includes(g.id);
                return (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] hover:bg-panel-2">
                    <input type="checkbox" checked={on} disabled={pending} onChange={() => toggle(g.id)} className="accent-[var(--color-brand)]" />
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_TONE[g.kind] || KIND_TONE.other}`} />
                  </label>
                );
              })}
              {pending && <p className="px-2.5 py-1 text-[11px] text-muted">Saving…</p>}
            </div>
          </>
        )}
      </div>

      {/* Documents, access, remove */}
      <div className="flex items-center gap-1.5 md:justify-end">
        <button
          disabled={pending}
          onClick={() => change(m.id, { can_see_documents: !m.can_see_documents })}
          title={m.can_see_documents ? "Opens the confidential Documents folder — click to take it away" : "Can't open the confidential Documents folder — click to allow"}
          className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition ${m.can_see_documents ? "bg-brand/15 text-brand" : "text-faint hover:bg-panel-2 hover:text-ink"}`}
        >
          <Icon name="lock" size={12} /> Docs
        </button>
        <select value={m.role} disabled={pending || isMe} onChange={(e) => change(m.id, { role: e.target.value })} className="field h-8 w-auto rounded-full !py-0 text-xs">
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        {isMe ? (
          <span className="w-8" />
        ) : (
          <button
            disabled={pending}
            onClick={() => (m.active ? confirm(`Remove ${m.name}'s access? They won't be able to sign in.`) : true) && change(m.id, { active: !m.active })}
            title={m.active ? "Remove access" : "Restore access"}
            className={`grid h-8 w-8 place-items-center rounded-full transition ${m.active ? "text-faint hover:bg-rose-500/10 hover:text-rose-400" : "text-emerald-500 hover:bg-emerald-500/10"}`}
          >
            <Icon name={m.active ? "x" : "refresh"} size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

function AddPerson({ groups }) {
  const [state, action, pending] = useActionState(addMember, {});
  return (
    <form action={action} key={state?.message} className="flex flex-col gap-4">
      {state?.message && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600 dark:text-emerald-400">
          <Icon name="check" size={14} /> {state.message} Add the next one, or close.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="field" placeholder="Full name" autoFocus />
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
      </div>
      <div>
        <label className="label" htmlFor="email">Google account email</label>
        <input id="email" name="email" type="email" required className="field" placeholder="name@inloopmedia.com or name@amsglobal.io" />
      </div>
      <div>
        <span className="label">Groups</span>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <label key={g.id} className="flex cursor-pointer items-center gap-2 rounded-full bg-panel-2 px-3 py-1.5 text-[12.5px] transition has-[:checked]:bg-solid has-[:checked]:text-on-solid">
              <input type="checkbox" name="groups" value={g.id} className="sr-only" />
              {g.name}
            </label>
          ))}
          {!groups.length && <span className="text-sm text-muted">Create a group first.</span>}
        </div>
      </div>
      {state?.error && <p className="text-sm text-rose-400">{state.error}</p>}
      <div className="flex justify-end border-t border-line pt-4">
        <button disabled={pending} className="btn-primary btn-sm">
          <Icon name="plus" size={13} /> {pending ? "Adding…" : "Add person"}
        </button>
      </div>
    </form>
  );
}

function People({ members, groups, meId }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [adding, setAdding] = useState(false);
  const term = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      members
        .filter((m) => (!term || `${m.name} ${m.email}`.toLowerCase().includes(term)) && (!group || (group === "none" ? !m.groups.length : m.groups.some((g) => g.id === group))))
        .sort((a, b) => Number(b.active) - Number(a.active)),
    [members, term, group]
  );
  const active = members.filter((m) => m.active).length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Icon name="search" size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" className="field !rounded-full py-2 !pl-9" />
        </div>
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="field w-auto !rounded-full py-2 text-[13px]">
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          <option value="none">In no group</option>
        </select>
        <span className="flex-1" />
        <span className="text-[12px] text-muted">
          {active} with access{members.length > active ? ` · ${members.length - active} removed` : ""}
        </span>
        <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
          <Icon name="plus" size={13} /> Add person
        </button>
      </div>

      <div className="card overflow-visible !p-0">
        <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] gap-x-4 border-b border-line px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-faint md:grid">
          <span>Person</span>
          <span>Groups</span>
          <span className="pr-10 text-right">Docs · Access</span>
        </div>
        {shown.length ? (
          <ul>
            {shown.map((m) => (
              <MemberRow key={m.id} m={m} isMe={m.id === meId} groups={groups} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-muted">No one matches that.</p>
        )}
      </div>

      <details className="group text-[12.5px] text-muted">
        <summary className="cursor-pointer list-none hover:text-ink">
          <Icon name="chevron" size={11} className="mr-1 inline transition group-open:rotate-90" /> What do Admin, Ops and Member mean? · Docs = can open the confidential Documents folder in every brand&apos;s library
        </summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.id} className="well px-4 py-3">
              <dt className="font-medium text-ink">{r.label}</dt>
              <dd className="mt-0.5">{r.help}</dd>
            </div>
          ))}
        </dl>
      </details>

      {adding && (
        <Popup title="Add a person" onClose={() => setAdding(false)}>
          <p className="mb-4 text-[12.5px] text-muted">Only people listed on this page can sign in.</p>
          <AddPerson groups={groups} />
        </Popup>
      )}
    </section>
  );
}

/* ------------------------------ Groups ------------------------------ */

function GroupCard({ g, members, opsHeads }) {
  const { pending, error, change } = useChange(updateGroup);
  const [open, setOpen] = useState(false);
  const kind = GROUP_KINDS.find((k) => k.id === g.kind);
  const everyone = members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const people = g.members.filter((m) => m.active);
  const posts = UPDATE_EVENTS.filter((e) => (g.notify || []).includes(e.id));

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-medium">{g.name}</div>
          <span title={kind?.help} className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${KIND_TONE[g.kind] || KIND_TONE.other}`}>
            {kind?.label}
          </span>
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

      <div className="mt-3 flex items-center gap-2">
        <span className="flex -space-x-2">
          {people.slice(0, 6).map((m) => (
            <Avatar key={m.id} name={m.name} size={26} />
          ))}
        </span>
        <span className="truncate text-[12px] text-muted">{people.length ? `${people.length} ${people.length === 1 ? "person" : "people"}` : "No one yet"}</span>
      </div>

      <p className="mt-3 truncate text-[12px] text-muted" title={posts.map((e) => e.label).join(", ")}>
        <span className="text-faint">Posts here:</span> {posts.length ? posts.map((e) => e.label).join(", ") : "nothing"}
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12.5px] font-medium text-muted hover:text-ink"
      >
        {open ? "Close" : "People, managers & posts"}
        <Icon name="chevron" size={12} className={`transition ${open ? "-rotate-90" : "rotate-90"}`} />
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted">Posts here</div>
            <div className="flex flex-wrap gap-1.5">
              {UPDATE_EVENTS.map((e) => {
                const on = (g.notify || []).includes(e.id);
                return (
                  <button
                    key={e.id}
                    disabled={pending}
                    onClick={() => change(g.id, { notify: on ? g.notify.filter((x) => x !== e.id) : [...(g.notify || []), e.id] })}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${on ? "solid" : "border border-dashed border-line-strong text-faint hover:text-ink"}`}
                  >
                    <Icon name={e.icon} size={11} />
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>
          <GroupPeople group={g} members={g.members} everyone={everyone} opsHeads={opsHeads} admin />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function NewGroup({ opsHeads }) {
  const [state, action, pending] = useActionState(createGroup, {});
  return (
    <form action={action} key={state?.message} className="flex flex-col gap-3">
      {state?.message && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600 dark:text-emerald-400">{state.message}</p>}
      <div>
        <label className="label">Name</label>
        <input name="name" required placeholder="e.g. Performance Team" className="field" autoFocus />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Comes under</label>
          <select name="owner" defaultValue="" className="field">
            <option value="">Admin</option>
            {opsHeads.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Works like</label>
          <select name="kind" defaultValue="other" className="field">
            {GROUP_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <span className="label">Posts here</span>
        <div className="flex flex-wrap gap-1.5">
          {UPDATE_EVENTS.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-panel-2 px-3 py-1.5 text-[12px] transition has-[:checked]:bg-solid has-[:checked]:text-on-solid">
              <input type="checkbox" name="notify" value={e.id} className="sr-only" />
              <Icon name={e.icon} size={11} /> {e.label}
            </label>
          ))}
        </div>
      </div>
      {state?.error && <p className="text-xs text-rose-400">{state.error}</p>}
      <div className="flex justify-end border-t border-line pt-4">
        <button disabled={pending} className="btn-primary btn-sm">
          <Icon name="plus" size={13} /> {pending ? "Creating…" : "Create group"}
        </button>
      </div>
    </form>
  );
}

function Groups({ groups, members, opsHeads }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted">
          What someone can do comes from their groups — one person can be in many. The CBO group comes under Admin; every other group comes under one CBO, who manages it if it has no manager of its own.
        </p>
        <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
          <Icon name="plus" size={13} /> New group
        </button>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <GroupCard key={g.id} g={g} members={members} opsHeads={opsHeads} />
        ))}
      </div>
      {adding && (
        <Popup title="New group" onClose={() => setAdding(false)} width={520}>
          <NewGroup opsHeads={opsHeads} />
        </Popup>
      )}
    </section>
  );
}

/* --------------------------- Meeting guests --------------------------- */

function GuestRow({ g }) {
  const { pending, error, change } = useChange(updateGuest);
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0 ${g.active ? "" : "opacity-50"}`}>
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <Avatar name={g.name} size={32} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{g.name}</div>
          <div className="truncate text-[11.5px] text-muted">{g.email}</div>
          {error && <div className="mt-0.5 text-[11px] text-rose-400">{error}</div>}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={g.is_default} disabled={pending || !g.active} onChange={(e) => change(g.id, { is_default: e.target.checked })} className="accent-[var(--color-brand)]" />
        Pre-selected
      </label>
      <button disabled={pending} onClick={() => change(g.id, { active: !g.active })} className="rounded-full px-3 py-1.5 text-xs text-muted transition hover:bg-panel-2 hover:text-rose-400">
        {g.active ? "Remove" : "Restore"}
      </button>
    </li>
  );
}

function Guests({ guests }) {
  const [state, action, pending] = useActionState(addGuest, {});
  return (
    <section className="flex flex-col gap-4">
      <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted">
        Who executives can add to a discovery call. They pick by name; the invite goes to these emails. &quot;Pre-selected&quot; people are ticked by default.
      </p>
      <form action={action} key={state?.message} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <input name="name" required className="field" placeholder="Name" aria-label="Name" />
        <input name="email" type="email" required className="field" placeholder="name@inloopmedia.com" aria-label="Email" />
        <button disabled={pending} className="btn-primary btn-sm shrink-0">
          <Icon name="plus" size={13} /> {pending ? "Adding…" : "Add guest"}
        </button>
      </form>
      {(state?.error || state?.message) && <p className={`-mt-2 text-sm ${state.error ? "text-rose-400" : "text-emerald-400"}`}>{state.error || state.message}</p>}
      {guests.length > 0 && (
        <ul className="card !p-0">
          {guests.map((g) => (
            <GuestRow key={g.id} g={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function TeamManager({ members, groups: raw, guests = [], meId }) {
  const groups = sortGroups(raw);
  const name = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const opsHeads = operationsHeadIds(groups).filter((id) => name[id]).map((id) => ({ id, name: name[id] }));
  const hash = useHash();
  const tab = hash === "#groups" ? "groups" : hash === "#guests" ? "guests" : "people";
  const tabs = [
    ["people", "People", members.filter((m) => m.active).length],
    ["groups", "Groups", groups.length],
    ["guests", "Meeting guests", guests.filter((g) => g.active).length],
  ];

  return (
    <div className="flex flex-col gap-5">
      <nav className="inline-flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-full bg-panel p-1 shadow-[var(--card-shadow)]">
        {tabs.map(([id, label, n]) => (
          <a
            key={id}
            href={`#${id}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-1.5 text-[12.5px] font-medium transition ${tab === id ? "bg-solid text-on-solid" : "text-muted hover:text-ink"}`}
          >
            {label}
            <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${tab === id ? "bg-white/20" : "bg-panel-2 text-muted"}`}>{n}</span>
          </a>
        ))}
      </nav>
      <div className="rise">
        {tab === "people" && <People members={members} groups={groups} meId={meId} />}
        {tab === "groups" && <Groups groups={groups} members={members} opsHeads={opsHeads} />}
        {tab === "guests" && <Guests guests={guests} />}
      </div>
    </div>
  );
}
