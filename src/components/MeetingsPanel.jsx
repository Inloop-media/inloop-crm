"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import ConnectCalendar from "@/components/ConnectCalendar";
import Icon from "@/components/Icon";
import { cancelMeeting, meetingSlots, scheduleMeeting } from "@/app/(crm)/actions";
import { DISCOVERY_STATUS, MEETING_KINDS, MEETING_MINUTES } from "@/lib/constants";
import { fmtMeeting } from "@/lib/format";


/** Multi-select of teammates to add to the invite. Names only — the server knows the emails. */
function GuestPicker({ guests, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const picked = guests.filter((g) => value.includes(g.id));

  return (
    <div ref={ref} className="relative">
      <span className="label">Add guests</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex min-h-[44px] flex-wrap items-center gap-1.5 bg-panel text-left"
        aria-expanded={open}
      >
        {picked.length ? (
          picked.map((g) => (
            <span key={g.id} className="chip bg-tint-lavender">
              {g.name}
              <span
                role="button"
                aria-label={`Remove ${g.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(g.id);
                }}
                className="text-faint hover:text-rose-300"
              >
                ×
              </span>
            </span>
          ))
        ) : (
          <span className="text-faint">No guests — only the client is invited</span>
        )}
        <Icon name="chevron" size={15} className="ml-auto text-faint" />
      </button>
      {open && (
        <ul className="pop absolute z-30 mt-2 max-h-64 w-full overflow-y-auto p-1.5">
          {guests.map((g) => {
            const on = value.includes(g.id);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-panel-2 ${on ? "text-ink" : "text-ink/75"}`}
                >
                  <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border ${on ? "border-brand bg-brand text-on-brand" : "border-line-strong"}`}>
                    {on && <Icon name="check" size={11} />}
                  </span>
                  {g.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const IST = "Asia/Kolkata";
const nowMs = () => Date.now();
const todayIST = () => new Date(nowMs() + 5.5 * 3600e3).toISOString().slice(0, 10);
const hhmm = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
// Bookable slots: 10:00 am to 8:30 pm, every 30 minutes
const SLOTS = Array.from({ length: 22 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const slotLabel = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

/** Pick a day, then a free 30-minute slot. Slots someone else already booked are greyed out. */
function SlotPicker({ minutes, value, onChange }) {
  const [day, setDay] = useState(todayIST);
  const [taken, setTaken] = useState(null);
  useEffect(() => {
    let live = true;
    meetingSlots(day)
      .then((r) => live && setTaken(r.taken || []))
      .catch(() => live && setTaken([]));
    return () => {
      live = false;
    };
  }, [day]);
  const startOf = (t) => new Date(`${day}T${t}:00+05:30`).getTime();
  const clash = (t) => {
    const s = startOf(t);
    const e = s + minutes * 60e3;
    return (taken || []).find((m) => new Date(m.start).getTime() < e && new Date(m.end).getTime() > s);
  };
  return (
    <div>
      <span className="label">When</span>
      <input
        type="date"
        value={day}
        min={todayIST()}
        suppressHydrationWarning
        onChange={(e) => {
          setDay(e.target.value);
          setTaken(null);
          onChange("");
        }}
        className="field bg-panel"
        aria-label="Meeting date"
      />
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {SLOTS.map((t) => {
          const past = startOf(t) < nowMs();
          const busy = clash(t);
          const on = value === `${day}T${t}`;
          return (
            <button
              key={t}
              type="button"
              disabled={past || !!busy || taken === null}
              title={busy ? `Taken — ${busy.by}` : ""}
              onClick={() => onChange(`${day}T${t}`)}
              className={`rounded-lg px-1 py-1.5 text-[12px] font-medium tabular-nums transition ${
                on ? "bg-brand text-white" : busy ? "cursor-not-allowed bg-panel-2 text-faint line-through" : past ? "cursor-not-allowed text-faint opacity-50" : "border border-line bg-panel hover:border-brand hover:text-brand"
              }`}
            >
              {slotLabel(t)}
            </button>
          );
        })}
      </div>
      {taken?.length > 0 && (
        <p className="mt-2 text-[11.5px] text-muted">
          Already booked that day: {taken.map((m) => `${hhmm.format(new Date(m.start))}–${hhmm.format(new Date(m.end))} (${m.by.split(" ")[0]})`).join(", ")}
        </p>
      )}
    </div>
  );
}

/** Anyone outside the team the client wants on the call: type an email, press Add. */
function OtherGuests({ value, onChange }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const add = () => {
    const e = text.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setErr("That email doesn't look right.");
    if (!value.includes(e)) onChange([...value, e]);
    setText("");
    setErr("");
  };
  return (
    <div>
      <span className="label">Other guests (from the client&apos;s side)</span>
      <div className="flex gap-2">
        <input
          type="email"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="partner@theirbrand.com"
          className="field bg-panel"
        />
        <button type="button" onClick={add} className="btn-ghost shrink-0">
          <Icon name="plus" size={13} /> Add
        </button>
      </div>
      {err && <p className="mt-1 text-[11.5px] text-rose-400">{err}</p>}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((e) => (
            <span key={e} className="chip bg-tint-lavender">
              {e}
              <button type="button" aria-label={`Remove ${e}`} onClick={() => onChange(value.filter((x) => x !== e))} className="text-faint hover:text-rose-300">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Booker({ leadId, kind, ready, blockedReason, connected, domain, guests = [], clientEmails = [] }) {
  const [when, setWhen] = useState("");
  const [guestIds, setGuestIds] = useState(() => (kind === "discovery" ? guests.filter((g) => g.is_default).map((g) => g.id) : []));
  const [toClient, setToClient] = useState(clientEmails);
  const [others, setOthers] = useState([]);
  const [minutes, setMinutes] = useState(MEETING_MINUTES[kind]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const info = MEETING_KINDS[kind];

  const book = () =>
    start(async () => {
      const res = await scheduleMeeting(leadId, kind, when, guestIds, { clientEmails: toClient, guestEmails: others, minutes });
      if (res.ok) {
        setWhen("");
        setOthers([]);
        setMsg({ ok: true, text: res.invited?.length ? `Booked — invite sent to ${res.invited.join(", ")}` : "Booked." });
      } else setMsg({ ok: false, text: res.error, reconnect: res.reconnect });
    });

  return (
    <div className="well p-5">
      <div className="flex items-center gap-3">
        <span className="icon-tile h-9 w-9">
          <Icon name="video" size={15} />
        </span>
        <div>
          <div className="text-sm font-medium">Book {info.label.toLowerCase()}</div>
          <div className="text-[11px] text-muted">{minutes === 60 ? "1 hour" : `${minutes} min`} · Google Meet</div>
        </div>
      </div>
      {!ready ? (
        <p className="mt-3 rounded-xl bg-panel px-3.5 py-2.5 text-xs text-muted">{blockedReason}</p>
      ) : !connected ? (
        <div className="mt-3">
          <p className="mb-3 text-xs text-muted">The invite goes out from your own Google Calendar, so connect it once.</p>
          <ConnectCalendar domain={domain} className="btn-ghost w-full" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {clientEmails.length > 0 && (
            <div>
              <span className="label">Client</span>
              <div className="flex flex-wrap gap-1.5">
                {clientEmails.map((e) => {
                  const on = toClient.includes(e);
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setToClient(on ? toClient.filter((x) => x !== e) : [...toClient, e])}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition ${on ? "bg-brand/15 text-ink shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "bg-panel text-muted"}`}
                    >
                      {on && <Icon name="check" size={12} />}
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {guests.length > 0 && <GuestPicker guests={guests} value={guestIds} onChange={setGuestIds} />}
          <OtherGuests value={others} onChange={setOthers} />
          <div>
            <span className="label">How long</span>
            <div className="flex gap-1.5">
              {[
                [30, "30 min"],
                [60, "1 hour"],
              ].map(([m, l]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMinutes(m);
                    setWhen("");
                  }}
                  className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition ${minutes === m ? "solid" : "bg-panel text-muted hover:text-ink"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <SlotPicker minutes={minutes} value={when} onChange={setWhen} />
          <button onClick={book} disabled={!when || pending} className="btn-primary">
            <Icon name="video" size={14} />
            {pending ? "Booking…" : when ? `Book for ${slotLabel(when.slice(11))}` : "Pick a slot"}
          </button>
          {kind === "proposal" && <p className="-mt-2 text-[11px] text-muted">The brief goes to the creative strategists. After this, the admin team takes the lead forward.</p>}
        </div>
      )}
      {msg && (
        <div className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>
          {msg.text}
          {msg.reconnect && <ConnectCalendar domain={domain} className="ml-2 underline">Reconnect</ConnectCalendar>}
        </div>
      )}
    </div>
  );
}

function MeetingRow({ m, meId, canCancelProposal, isAdmin }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const info = MEETING_KINDS[m.kind];
  const past = m.past;
  const canCancel = !past && (m.organizer?.id === meId || isAdmin || (m.kind === "proposal" && canCancelProposal));

  return (
    <li className={`flex items-center gap-3.5 rounded-2xl p-3.5 ${past ? "bg-panel-2/50" : "well"}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: info.color, opacity: past ? 0.45 : 1 }}>
        <Icon name="video" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className={`font-medium ${past ? "text-muted" : ""}`}>{fmtMeeting(m.starts_at)}</span>
          <span className="text-xs text-muted">· {info.label}</span>
          {past && <span className="rounded-full bg-panel-3 px-2 py-0.5 text-[10px] font-medium text-muted">Done</span>}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          by {m.organizer?.name || "—"}
          {m.attendees?.length ? ` · ${m.attendees.join(", ")}` : ""}
        </div>
        {error && <div className="mt-1 text-xs text-rose-400">{error}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {m.meet_link && !past && (
          <a href={m.meet_link} target="_blank" rel="noreferrer" className="btn-primary btn-sm">
            <Icon name="video" size={13} /> Join
          </a>
        )}
        {canCancel && (
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm("Cancel this meeting? Guests get a cancellation email.")) return;
              start(async () => {
                const res = await cancelMeeting(m.id);
                setError(res.ok ? "" : res.error);
              });
            }}
            className="rounded-full px-3 py-1.5 text-xs text-muted transition hover:bg-panel hover:text-rose-400"
          >
            {pending ? "…" : "Cancel"}
          </button>
        )}
      </div>
    </li>
  );
}

export default function MeetingsPanel({ lead, meetings, me, canDiscovery, canProposal, proposalReady = true, connected, domain, guests, clientEmails = [] }) {
  const live = (kind) => meetings.some((m) => m.kind === kind && !m.past);
  const isAdmin = me.role === "admin";

  return (
    <div className="flex flex-col gap-4">
      {meetings.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {meetings.map((m) => (
            <MeetingRow key={m.id} m={m} meId={me.id} canCancelProposal={canProposal} isAdmin={isAdmin} />
          ))}
        </ul>
      ) : (
        <p className="well-empty px-4 py-6 text-center text-sm text-muted">No meetings yet.</p>
      )}

      {canDiscovery && !live("discovery") && !lead.has_proposal && (
        <Booker
          leadId={lead.id}
          kind="discovery"
          guests={guests}
          clientEmails={clientEmails}
          ready={lead.status === DISCOVERY_STATUS}
          blockedReason={`Set the status to "${DISCOVERY_STATUS}" to book the first call.`}
          connected={connected}
          domain={domain}
        />
      )}
      {canProposal && !live("proposal") && (
        <Booker
          leadId={lead.id}
          kind="proposal"
          guests={guests}
          clientEmails={clientEmails}
          ready={lead.has_brief && proposalReady}
          blockedReason={!proposalReady ? `Do the discovery call first — book it above, or set the status to "${DISCOVERY_STATUS}".` : "Write the client brief in Notes first — it goes to the creative strategists when this meeting is booked."}
          connected={connected}
          domain={domain}
        />
      )}
    </div>
  );
}
