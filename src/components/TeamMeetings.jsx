"use client";
// Dashboard card: the team meetings you're in, and (for team leads, managers, CBOs, admin) a button to
// call one — with whole groups (everyone in them gets their own invite) and/or one-on-one with people.
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import ConnectCalendar from "@/components/ConnectCalendar";
import { cancelMeeting, scheduleTeamMeeting } from "@/app/(crm)/meetings/actions";

const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
const DURATIONS = [15, 30, 45, 60, 90, 120];

function whoLine(m) {
  if (m.groups.length) return m.groups.join(", ");
  if (m.people.length === 1) return m.mine ? `One-on-one with ${m.people[0]}` : `One-on-one with ${m.organizer}`;
  return m.people.slice(0, 3).join(", ") + (m.people.length > 3 ? ` +${m.people.length - 3}` : "");
}

function MeetingRow({ m, now }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = new Date(m.starts_at).getTime();
  const live = start - 10 * 60e3 <= now && now <= new Date(m.ends_at).getTime();
  const k = dayKey(m.starts_at);
  const day = k === dayKey(now) ? "Today" : k === dayKey(now + 864e5) ? "Tomorrow" : dayFmt.format(new Date(m.starts_at));
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-panel-2 px-3 py-2.5">
      <span className={`w-[76px] shrink-0 rounded-xl px-2 py-1.5 text-center leading-tight ${live ? "bg-brand text-white" : "bg-panel"}`}>
        <span className={`block text-[10px] ${live ? "text-white/80" : "text-muted"}`}>{live ? "Now" : day}</span>
        <span className="block whitespace-nowrap text-xs font-medium tabular-nums">{timeFmt.format(new Date(m.starts_at))}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{m.title}</div>
        <div className="truncate text-[11px] text-muted">
          {whoLine(m)} · {m.mine ? "called by you" : `by ${m.organizer}`}
        </div>
        {error && <div className="text-[11px] text-rose-400">{error}</div>}
      </div>
      {m.mine && (
        <button
          type="button"
          disabled={busy}
          title="Cancel meeting"
          onClick={async () => {
            if (!confirm(`Cancel "${m.title}"? Everyone invited gets told.`)) return;
            setBusy(true);
            const r = await cancelMeeting(m.id);
            setBusy(false);
            if (!r.ok) setError(r.error);
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint hover:bg-panel hover:text-rose-400"
        >
          <Icon name="x" size={14} />
        </button>
      )}
      {m.meet_link && (
        <a href={m.meet_link} target="_blank" rel="noreferrer" className={`shrink-0 ${live ? "btn-primary" : "btn-ghost"} btn-sm`}>
          <Icon name="video" size={13} /> Join
        </a>
      )}
    </li>
  );
}

function Toggle({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition ${on ? "bg-brand/15 text-ink shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "bg-panel-2 text-muted hover:text-ink"}`}
    >
      {on && <Icon name="check" size={12} />}
      {children}
    </button>
  );
}

function Scheduler({ audience, connected, domain, onClose }) {
  const [f, setF] = useState({ title: "", when: "", minutes: 30, agenda: "" });
  const [groupIds, setGroupIds] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const flip = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const invited = useMemo(() => {
    const ids = new Set(memberIds);
    for (const g of audience.groups) if (groupIds.includes(g.id)) for (const p of g.people) ids.add(p.id);
    return ids;
  }, [audience.groups, groupIds, memberIds]);
  const fromGroups = useMemo(() => {
    const ids = new Set();
    for (const g of audience.groups) if (groupIds.includes(g.id)) for (const p of g.people) ids.add(p.id);
    return ids;
  }, [audience.groups, groupIds]);
  const people = audience.people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <form
        className="pop relative flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          const r = await scheduleTeamMeeting({ ...f, groupIds, memberIds });
          setBusy(false);
          if (!r.ok) return setMsg({ error: r.error, reconnect: r.reconnect });
          onClose();
        }}
      >
        <div>
          <h2 className="text-[15px] font-medium">Schedule a meeting</h2>
          <p className="text-xs text-muted">Everyone you pick gets the Google Meet invite on their own email, and sees it on their dashboard.</p>
        </div>
        <div>
          <label className="label" htmlFor="tm-title">Title *</label>
          <input id="tm-title" className="field" required autoFocus placeholder="e.g. Weekly design review" value={f.title} onChange={set("title")} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label" htmlFor="tm-when">Date & time *</label>
            <input id="tm-when" type="datetime-local" required className="field" value={f.when} onChange={set("when")} />
          </div>
          <div>
            <label className="label" htmlFor="tm-min">How long</label>
            <select id="tm-min" className="field" value={f.minutes} onChange={set("minutes")}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60} hr${d > 60 ? "s" : ""}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        {audience.groups.length > 0 && (
          <div>
            <span className="label">Groups</span>
            <div className="flex flex-wrap gap-1.5">
              {audience.groups.map((g) => (
                <Toggle key={g.id} on={groupIds.includes(g.id)} onClick={() => flip(groupIds, setGroupIds, g.id)}>
                  {g.name} <span className="text-faint">· {g.people.length}</span>
                </Toggle>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="label">People (one-on-one, or add to the groups)</span>
          {audience.people.length > 8 && <input className="field mb-2 py-1.5 text-sm" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {people.map((p) => (
              <Toggle key={p.id} on={invited.has(p.id)} onClick={() => (fromGroups.has(p.id) ? null : flip(memberIds, setMemberIds, p.id))}>
                <Avatar name={p.name} size={18} /> {p.name}
              </Toggle>
            ))}
            {!people.length && <span className="text-xs text-faint">No one found.</span>}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tm-agenda">Agenda</label>
          <textarea id="tm-agenda" rows={3} className="field resize-y" placeholder="What's it about?" value={f.agenda} onChange={set("agenda")} />
        </div>
        {msg?.error && (
          <p className="text-xs text-rose-400">
            {msg.error} {msg.reconnect && <ConnectCalendar domain={domain} className="ml-1 underline">Reconnect</ConnectCalendar>}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{invited.size ? `${invited.size} ${invited.size === 1 ? "person" : "people"} will be invited` : "Pick a group or a person"}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">
              Cancel
            </button>
            {connected ? (
              <button disabled={busy || !invited.size} className="btn-primary btn-sm">
                <Icon name="calendar" size={13} /> {busy ? "Booking…" : "Schedule"}
              </button>
            ) : (
              <ConnectCalendar domain={domain} className="btn-primary btn-sm">
                Connect Google Calendar first
              </ConnectCalendar>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

/** meetings: from lib/teamMeetings; audience: null when this person can't call meetings. */
export default function TeamMeetings({ meetings, audience, connected, domain, now }) {
  const [open, setOpen] = useState(false);
  if (!meetings.length && !audience) return null;
  return (
    <section className="card rise min-w-0 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-normal tracking-[-0.01em]">Meetings</h2>
          <p className="text-xs text-muted">{meetings.length ? "Team meetings you're in" : "Nothing coming up"}</p>
        </div>
        {audience && (
          <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm">
            <Icon name="plus" size={13} /> Schedule meeting
          </button>
        )}
      </div>
      {meetings.length > 0 ? (
        <ul className="grid gap-2 lg:grid-cols-2">
          {meetings.map((m) => (
            <MeetingRow key={m.id} m={m} now={now} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-panel-2 px-3 py-3 text-xs text-muted">Call a meeting with your groups, or a one-on-one with anyone in your team.</p>
      )}
      {open && audience && createPortal(<Scheduler audience={audience} connected={connected} domain={domain} onClose={() => setOpen(false)} />, document.body)}
    </section>
  );
}
