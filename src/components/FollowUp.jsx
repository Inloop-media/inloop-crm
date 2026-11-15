"use client";
// A follow-up reminder on a lead: pick when to call back (quick picks or a date and time) and a note.
// At that time the lead's owner gets a phone notification.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { setFollowUp } from "@/app/(crm)/actions";

const IST = "Asia/Kolkata";
const nowMs = () => Date.now();
const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
/** "YYYY-MM-DDTHH:MM" in India time, N days from now at 11:00 */
const inDays = (n) => `${new Date(nowMs() + n * 864e5).toLocaleDateString("en-CA", { timeZone: IST })}T11:00`;
const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-CA", { timeZone: IST })}T${d.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" })}`;
};

const PICKS = [
  ["Tomorrow", 1],
  ["In 3 days", 3],
  ["Next week", 7],
  ["In 2 weeks", 14],
];

export default function FollowUp({ leadId, at, note }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!at);
  const [when, setWhen] = useState(toLocal(at) || inDays(3));
  const [text, setText] = useState(note || "");
  const [error, setError] = useState("");
  const due = at && new Date(at).getTime() <= nowMs();

  const save = (value, msg = text) =>
    start(async () => {
      setError("");
      const res = await setFollowUp(leadId, value, msg);
      if (!res.ok) return setError(res.error);
      setEditing(!value);
      router.refresh();
    });

  if (at && !editing)
    return (
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${due ? "border-brand/40 bg-brand/10" : "border-line bg-panel-2"}`}>
        <span className={`grid h-9 w-9 place-items-center rounded-full ${due ? "bg-brand text-white" : "bg-panel text-brand"}`}>
          <Icon name="bell" size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{due ? "Follow up now" : "Follow up"} · {fmt.format(new Date(at))}</div>
          {note && <div className="truncate text-xs text-muted">{note}</div>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => save("")} disabled={pending} className="btn-primary btn-sm">
            <Icon name="check" size={13} /> Done
          </button>
          <button onClick={() => setEditing(true)} disabled={pending} className="btn-ghost btn-sm">
            Change
          </button>
        </div>
        {error && <p className="w-full text-xs text-rose-400">{error}</p>}
      </div>
    );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save(when);
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {PICKS.map(([label, n]) => (
          <button key={label} type="button" onClick={() => setWhen(inDays(n))} className={`rounded-full border px-3 py-1.5 text-xs transition ${when === inDays(n) ? "border-brand bg-brand/12 text-ink" : "border-line text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field w-auto" required />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Note — e.g. send the revised quote" className="field min-w-[200px] flex-1" maxLength={300} />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn-primary btn-sm">
          <Icon name="bell" size={13} /> {pending ? "Saving…" : "Remind me"}
        </button>
        {at && (
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost btn-sm">
            Cancel
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted">You&apos;ll get a phone notification at this time (India time).</p>
    </form>
  );
}
