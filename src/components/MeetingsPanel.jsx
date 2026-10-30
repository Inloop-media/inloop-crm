"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import ConnectCalendar from "@/components/ConnectCalendar";
import Icon from "@/components/Icon";
import { cancelMeeting, scheduleMeeting } from "@/app/(crm)/actions";
import { DISCOVERY_STATUS, MEETING_KINDS } from "@/lib/constants";
import { fmtMeeting } from "@/lib/format";

// datetime-local value for "now" in India time, so past slots can't be picked
const nowIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 16);

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

function Booker({ leadId, kind, ready, blockedReason, connected, domain, guests = [] }) {
  const [when, setWhen] = useState("");
  const [guestIds, setGuestIds] = useState(() => guests.filter((g) => g.is_default).map((g) => g.id));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const info = MEETING_KINDS[kind];

  const book = () =>
    start(async () => {
      const res = await scheduleMeeting(leadId, kind, when, kind === "discovery" ? guestIds : []);
      if (res.ok) {
        setWhen("");
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
          <div className="text-[11px] text-muted">30 min · Google Meet</div>
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
        <>
          {kind === "discovery" && guests.length > 0 && (
            <div className="mt-3">
              <GuestPicker guests={guests} value={guestIds} onChange={setGuestIds} />
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="datetime-local"
              value={when}
              min={nowIST()}
              suppressHydrationWarning
              onChange={(e) => setWhen(e.target.value)}
              className="field bg-panel"
              aria-label={`${info.label} date and time`}
            />
            <button onClick={book} disabled={!when || pending} className="btn-primary shrink-0">
              <Icon name="video" size={14} />
              {pending ? "Booking…" : "Book Meet"}
            </button>
          </div>
          <p className="mt-2.5 text-[11px] text-muted">
            {kind === "discovery" ? "invites the client and the guests above" : "invites only the client · brief goes to the strategists"}
          </p>
        </>
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

export default function MeetingsPanel({ lead, meetings, me, canDiscovery, canProposal, connected, domain, guests }) {
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
          ready={lead.has_brief}
          blockedReason="Add the client brief first — it goes to the creative strategists when this meeting is booked."
          connected={connected}
          domain={domain}
        />
      )}
    </div>
  );
}
