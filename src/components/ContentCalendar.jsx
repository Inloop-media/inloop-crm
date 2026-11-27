"use client";
// One brand's content calendar for a month: the plan on top, then a month grid (or an agenda list on
// phones). Click a day to add a post, click a post to edit it, drag it to move it. Heads turn a post
// into a task for someone straight from here.
import DrivePicker from "@/components/DrivePicker";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import MonthGrid, { todayKey } from "@/components/MonthGrid";
import CalendarImport from "@/components/CalendarImport";
import { PersonSelect, PrioritySelect } from "@/components/TaskForms";
import { RawToggle } from "@/components/RawRequest";
import PostKit from "@/components/PostKit";
import { requestRaw } from "@/app/(crm)/tasks/actions";
import { assignCalendarItem, clearCalendarMonth, deleteCalendarItem, moveCalendarItem, saveCalendarItem, savePlan, setCalendarLock } from "@/app/(crm)/calendar/actions";
import WorkBar from "@/components/WorkBar";
import { Avatar } from "@/components/ui";
import { bucketOf, countBuckets } from "@/lib/workStatus";
import { CALENDAR_FIELDS, CALENDAR_TYPES, PLAN_KINDS, PLATFORMS, TASK_KINDS, TASK_STATUSES, kindPlural, platformLabel, platformList, taskKindLabel } from "@/lib/constants";

// Where a post's own Drive folder goes (matches lib/drive.js)
const DRIVE_DIR = { reel: "Reels", video: "Videos", carousel: "Carousel", story: "Stories", post: "Static Posts", design: "Static Posts" };
const DRIVE_NAME = { reel: "Reel", video: "Video", carousel: "Carousel", story: "Story", post: "Static Post", design: "Static Post" };
export const KIND_COLOR = { post: "#60a5fa", carousel: "#a78bfa", story: "#f472b6", reel: "#fbbf24", video: "#22d3ee", design: "#4ade80", website: "#94a3b8", other: "#94a3b8" };
const CONTENT_KINDS = TASK_KINDS.filter((k) => k.id !== "website");
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtKey = (k) => dayFmt.format(new Date(`${k}T00:00:00Z`));

/** Where an item stands, in one word. */
export function itemState(i) {
  if (i.status === "posted") return { label: "Posted", color: "#059669" };
  if (i.task?.status === "done") return { label: "Approved · to post", color: "#0ea5e9" };
  if (i.task) {
    const s = TASK_STATUSES[i.task.status];
    return { label: i.task.status === "completed" ? "In review" : s?.label || "Assigned", color: s?.color || "#60a5fa" };
  }
  return { label: "Not assigned", color: "#64627a" };
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn, after) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (res && !res.ok) return setError(res.error || "Something went wrong.");
      after?.(res);
      router.refresh();
    });
  return { pending, error, setError, run };
}

function Chip({ i, onOpen, draggable }) {
  const st = itemState(i);
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/item", i.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(i)}
      title={`${i.title} · ${st.label}`}
      className={`group/chip flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-125 ${i.status === "posted" ? "opacity-60" : ""}`}
      style={{ background: `color-mix(in srgb, ${KIND_COLOR[i.kind] || "#94a3b8"} 15%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: st.color }} />
      <span className="shrink-0 rounded px-1 text-[9px] font-semibold uppercase" style={{ background: `color-mix(in srgb, ${KIND_COLOR[i.kind] || "#94a3b8"} 30%, transparent)` }}>
        {taskKindLabel(i.kind)}
      </span>
      <span className={`min-w-0 flex-1 truncate ${i.status === "posted" ? "line-through" : ""}`}>{i.title}</span>
    </button>
  );
}

/* ------------------------------ Plan ------------------------------ */

function PlanCard({ brandId, month, monthName, plan, progress, canPlan }) {
  const { pending, error, run } = useRun();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(() => Object.fromEntries(PLAN_KINDS.map((k) => [k, plan?.targets?.[k] || ""])));
  const [notes, setNotes] = useState(plan?.notes || "");
  const pct = progress.target ? Math.min(100, Math.round((progress.planned / progress.target) * 100)) : 0;

  if (editing)
    return (
      <form
        className="card !rounded-3xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => savePlan(brandId, month, t, notes), () => setEditing(false));
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Deliverables for {monthName}</h3>
            <p className="text-xs text-muted">How many of each the brand gets this month. Next months copy it until you change it.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {PLAN_KINDS.map((k) => (
            <label key={k} className="well flex flex-col gap-1 p-3">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
                {kindPlural(k)}
              </span>
              <input type="number" min="0" max="200" inputMode="numeric" className="w-full bg-transparent text-2xl font-medium outline-none" placeholder="0" value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <textarea className="field mt-3 resize-y" rows={2} placeholder="Notes: themes for the month, campaigns, festivals…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost btn-sm">
            Cancel
          </button>
          <button disabled={pending} className="btn-primary btn-sm">
            {pending ? "Saving…" : "Save deliverables"}
          </button>
        </div>
      </form>
    );

  return (
    <section className="card !rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">
            {monthName} deliverables
            {plan?.inherited && <span className="ml-2 rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-normal text-muted">same as last month</span>}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {progress.target ? (
              <>
                <b className="font-medium text-ink">{progress.planned}</b> of {progress.target} planned · <b className="font-medium text-ink">{progress.assigned}</b> assigned · <b className="font-medium text-ink">{progress.done}</b> done
              </>
            ) : canPlan ? (
              "No deliverables yet — set how many posts, reels and stories this brand gets."
            ) : (
              "No deliverables set for this month yet — admin sets them."
            )}
          </p>
          {plan?.notes && <p className="mt-2 max-w-2xl whitespace-pre-line text-xs text-muted">{plan.notes}</p>}
        </div>
        {canPlan && (
          <button onClick={() => setEditing(true)} className="btn-ghost btn-sm">
            <Icon name="board" size={13} /> {progress.target ? "Edit deliverables" : "Set deliverables"}
          </button>
        )}
      </div>
      {progress.rows.length > 0 && (
        <>
          {progress.target > 0 && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-2">
              <span className="bar-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {progress.rows.map((r) => {
              const short = r.target && r.planned < r.target;
              return (
                <div key={r.kind} className="well p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[r.kind] }} />
                    {kindPlural(r.kind)}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-medium tabular-nums">{r.planned}</span>
                    {r.target > 0 && <span className="text-xs text-muted">/ {r.target}</span>}
                  </div>
                  <div className={`mt-0.5 text-[11px] ${short ? "text-amber-400" : "text-muted"}`}>{short ? `${r.target - r.planned} still to plan` : `${r.done} done`}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------ Item drawer ------------------------------ */

function Drawer({ item, brandId, people, canEdit, canAssign, canDelete = false, onClose }) {
  const { pending, error, run } = useRun();
  const isNew = !item.id;
  const [f, setF] = useState({
    title: item.title || "",
    kind: item.kind || "post",
    platform: item.platform || "instagram",
    publish_on: item.publish_on,
    caption: item.caption || "",
    notes: item.notes || "",
    creative_brief: item.creative_brief || "",
    creative_direction: item.creative_direction || "",
    caption_direction: item.caption_direction || "",
    cta_objective: item.cta_objective || "",
  });
  // Sheets with "Reference 1 / 2 / 3" columns (imported before they were read as references): those join
  // the references, and only the filled ones show
  const REF_COL = /^(reference|references|ref|refs|link|links|inspiration)\s*\d+$/i;
  const oldExtra = Array.isArray(item.extra) ? item.extra : [];
  const startRefs = [...(item.refs || []), ...oldExtra.filter((x) => REF_COL.test(String(x.label).trim()) && String(x.value || "").trim()).map((x) => String(x.value).trim())];
  const [refs, setRefs] = useState(startRefs.length ? startRefs : [""]);
  // Columns from the imported sheet that have no field of their own (Content Pillar, Hook…), under the sheet's names
  const [extra, setExtra] = useState(oldExtra.filter((x) => !REF_COL.test(String(x.label).trim())));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [who, setWho] = useState("");
  const [raw, setRaw] = useState(null); // needs raw photos / footage from Production first
  const twoDaysBefore = (() => {
    const d = new Date(`${f.publish_on}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 2);
    const k = d.toISOString().slice(0, 10);
    return k < todayKey() ? todayKey() : k;
  })();
  const [due, setDue] = useState(twoDaysBefore);
  const [dueTime, setDueTime] = useState("19:00");
  const [priority, setPriority] = useState("medium");
  const [folders, setFolders] = useState([]); // extra Drive folders for the task (its own post folder is automatic)
  const st = itemState(item);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-panel shadow-2xl">
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR[f.kind] }} />
          <h2 className="flex-1 text-sm font-medium">{isNew ? "New post" : canEdit ? "Edit post" : "Post"}</h2>
          {!isNew && (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${st.color} 15%, transparent)`, color: st.color }}>
              {st.label}
            </span>
          )}
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-panel-2" aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </header>

        <form
          id="cal-item"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveCalendarItem({ ...f, refs, extra, id: item.id, brand_id: brandId }), onClose);
          }}
        >
          <fieldset disabled={!canEdit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className="field" value={f.publish_on} onChange={set("publish_on")} required />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="field" value={f.kind} onChange={set("kind")}>
                  {CALENDAR_TYPES.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                  {!CALENDAR_TYPES.some((k) => k.id === f.kind) && <option value={f.kind}>{taskKindLabel(f.kind)}</option>}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Content idea</label>
              <textarea className="field resize-y" rows={2} value={f.title} onChange={set("title")} placeholder="e.g. Diwali offer — 20% off on all cakes" required autoFocus={isNew} />
            </div>
            {extra.map((x, i) => (
              <div key={x.label}>
                <label className="label">{x.label}</label>
                <div className="flex items-start gap-2">
                  <textarea className="field resize-y" rows={x.value.length > 80 ? 3 : 1} value={x.value} onChange={(e) => setExtra(extra.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
                  {/^https?:\/\/\S+$/.test(x.value.trim()) && (
                    <a href={x.value.trim()} target="_blank" rel="noreferrer" className="btn-ghost btn-sm mt-1 shrink-0">
                      Visit <Icon name="external" size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {CALENDAR_FIELDS.map((c) => (
              <div key={c.id}>
                <label className="label">{c.label}</label>
                {c.rows > 1 ? (
                  <textarea className="field resize-y" rows={c.rows} value={f[c.id]} onChange={set(c.id)} />
                ) : (
                  <input className="field" value={f[c.id]} onChange={set(c.id)} placeholder={c.id === "cta_objective" ? "e.g. DM to order, visit the website" : ""} />
                )}
              </div>
            ))}
            <div>
              <label className="label">References</label>
              <div className="flex flex-col gap-2">
                {refs.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="field"
                      value={r}
                      onChange={(e) => setRefs(refs.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder="Paste a link (Instagram, Pinterest, Drive…) or a note"
                    />
                    {/^https?:\/\//.test(r.trim()) && (
                      <a href={r.trim()} target="_blank" rel="noreferrer" className="btn-ghost btn-sm shrink-0" aria-label="Visit reference">
                        Visit <Icon name="external" size={12} />
                      </a>
                    )}
                    {canEdit && refs.length > 1 && (
                      <button type="button" onClick={() => setRefs(refs.filter((_, j) => j !== i))} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-muted hover:text-rose-400" aria-label="Remove reference">
                        <Icon name="x" size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && refs.length < 20 && (
                  <button type="button" onClick={() => setRefs([...refs, ""])} className="btn-ghost btn-sm self-start">
                    <Icon name="plus" size={12} /> Add reference
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="label">Platforms</span>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const list = platformList(f.platform);
                  const on = list.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = on ? list.filter((x) => x !== p.id) : [...list, p.id];
                        if (next.length) setF({ ...f, platform: next.join(",") });
                      }}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] transition disabled:opacity-60 ${on ? "bg-brand/15 text-ink shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "bg-panel-2 text-muted hover:text-ink"}`}
                    >
                      {on && <Icon name="check" size={12} />}
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-faint">Pick every platform it goes out on.</p>
            </div>
          </fieldset>

          {!isNew && (
            <section className="well flex flex-col gap-3 p-4">
              <h3 className="text-xs font-medium text-muted">{item.task ? "Task" : "Give it to a designer / editor"}</h3>
              {item.task && !canAssign ? (
                <p className="text-sm">
                  Made by <b className="font-medium">{item.task.assignee?.name || "—"}</b> · <span className="text-muted">{itemState(item).label}</span>
                </p>
              ) : item.task ? (
                <Link href={`/tasks/${item.task.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-brand">
                  <span>
                    Task with <b className="font-medium">{item.task.assignee?.name || "—"}</b>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    Open task <Icon name="arrow" size={12} />
                  </span>
                </Link>
              ) : canAssign ? (
                <div className="flex flex-col gap-2">
                  <PersonSelect people={people} value={who} onChange={setWho} kind={f.kind} />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted">Due</label>
                    <input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
                    <input type="time" aria-label="Due time" className="field w-auto" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
                    <PrioritySelect value={priority} onChange={setPriority} />
                  </div>
                  <RawToggle value={raw} onChange={setRaw} kind={f.kind} who={people.find((p) => p.id === who)?.name.split(" ")[0]} brandId={brandId} />
                  <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium">
                      <Icon name="board" size={13} className="text-amber-500" /> Google Drive
                    </span>
                    <p className="text-[11.5px] leading-relaxed text-muted">
                      This post gets its own folder automatically — <span className="text-ink/80">{DRIVE_DIR[f.kind] || "Static Posts"} / {DRIVE_NAME[f.kind] || "Static Post"} N – {String(f.title || "").slice(0, 40) || "idea"}</span>
                      {["reel", "video"].includes(f.kind) ? ", with Raw and Edited inside." : "."} Add more folders if the work goes elsewhere too.
                    </p>
                    <DrivePicker brandId={brandId} value={folders} onChange={setFolders} />
                  </div>
                  <button
                    type="button"
                    disabled={!who || pending || (raw && (!raw.assignee_id || !raw.brief.trim()))}
                    onClick={() =>
                      run(async () => {
                        const r = await assignCalendarItem(item.id, { assignee_id: who, due_at: due ? `${due}T${dueTime || "19:00"}` : due, priority, folders });
                        if (!r.ok || !raw) return r;
                        const q = await requestRaw(r.taskId, raw);
                        return q.ok ? r : { ok: false, error: `Task given, but the Production request didn't go: ${q.error} — ask from the task page.` };
                      }, onClose)
                    }
                    className="btn-primary btn-sm self-start"
                  >
                    <Icon name="tasks" size={13} /> {raw ? "Assign + ask Production" : "Assign as task"}
                  </button>
                  <p className="text-[11px] text-muted">The whole brief (direction, copy, references) goes into the task.</p>
                </div>
              ) : (
                <p className="text-xs text-muted">Not assigned yet — the CBOs assign it to a designer or editor.</p>
              )}
            </section>
          )}
          {!isNew && (item.task || item.status === "posted") && (
            <section className="well flex flex-col gap-3 p-4">
              <h3 className="text-xs font-medium text-muted">Posting</h3>
              <PostKit itemId={item.id} />
            </section>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </form>

        {canEdit && (
          <footer className="flex items-center gap-2 border-t border-line px-5 py-4">
            {!isNew && canDelete && (
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm("Delete this post from the calendar?") && run(() => deleteCalendarItem(item.id), onClose)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-400/10"
              >
                <Icon name="trash" size={14} /> Delete post
              </button>
            )}
            <span className="flex-1" />
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">
              Cancel
            </button>
            <button form="cal-item" disabled={pending} className="btn-primary btn-sm">
              {pending ? "Saving…" : isNew ? "Add to calendar" : "Save"}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

/** Admin / creative strategists: delete every post of this brand in the month. */
function ClearMonth({ brandId, month, monthName, count }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Delete all ${count} post${count === 1 ? "" : "s"} of ${monthName} from this calendar? Tasks already given stay.`)) return;
        setBusy(true);
        const r = await clearCalendarMonth(brandId, month);
        setBusy(false);
        if (!r.ok) return alert(r.error);
        router.refresh();
      }}
      className="btn-ghost btn-sm text-rose-400"
    >
      <Icon name="trash" size={13} /> {busy ? "Deleting…" : "Clear month"}
    </button>
  );
}

/* ------------------------------ Lock ------------------------------ */

const lockTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * The bar above the calendar: locked (no one can change it) or unlocked (someone is working on it).
 * While it's unlocked, the person who can lock it is asked to lock it before leaving the page.
 */
function LockBar({ brandId, lock, canLock }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(null); // the link they clicked
  const guard = canLock && lock.ready && !lock.locked;
  const guardRef = useRef(guard);
  useEffect(() => {
    guardRef.current = guard;
  }, [guard]);

  const set = (locked, then) =>
    start(async () => {
      setError("");
      const r = await setCalendarLock(brandId, locked);
      if (!r.ok) return setError(r.error);
      guardRef.current = !locked && canLock;
      router.refresh();
      then?.();
    });

  // Closing the tab / reloading while it's unlocked → the browser's "Leave site?" pop-up
  useEffect(() => {
    if (!guard) return;
    const onUnload = (e) => {
      if (!guardRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [guard]);

  // Clicking a link to another page while it's unlocked → our pop-up first
  useEffect(() => {
    if (!guard) return;
    const onClick = (e) => {
      if (!guardRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Moving between months of the same brand's calendar is not leaving it
      const here = new URL(window.location.href);
      const sameCalendar = url.pathname === here.pathname && (url.searchParams.get("brand") || "") === (here.searchParams.get("brand") || "") && url.searchParams.get("tab") === here.searchParams.get("tab");
      if (sameCalendar) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaving(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [guard]);

  const go = (href) => {
    guardRef.current = false;
    setLeaving(null);
    router.push(href);
  };

  if (!lock.ready) return null;
  return (
    <>
      <section className={`card flex flex-wrap items-center gap-3 !rounded-3xl px-4 py-3 ${lock.locked ? "" : "shadow-[inset_0_0_0_1.5px_rgb(251_191_36/0.6)]"}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${lock.locked ? "bg-panel-2 text-muted" : "bg-amber-400/15 text-amber-400"}`}>
          <Icon name="lock" size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{lock.locked ? "Calendar locked" : "Calendar unlocked — editing is open"}</div>
          <div className="text-xs text-muted">
            {lock.locked
              ? canLock
                ? "No one can change it. Unlock it to work on it, and lock it again when you're done."
                : "No one can change it right now. The creative strategists' team lead unlocks it."
              : `Unlocked${lock.by ? ` by ${lock.by}` : ""}${lock.at ? ` · ${lockTime.format(new Date(lock.at))}` : ""}. Lock it once the work is done.`}
          </div>
          {error && <div className="mt-1 text-xs text-rose-400">{error}</div>}
        </div>
        {canLock &&
          (lock.locked ? (
            <button type="button" disabled={pending} onClick={() => set(false)} className="btn-ghost btn-sm">
              {pending ? "Unlocking…" : "Unlock to edit"}
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={() => set(true)} className="btn-primary btn-sm">
              <Icon name="lock" size={13} /> {pending ? "Locking…" : "Lock calendar"}
            </button>
          ))}
      </section>

      {leaving &&
        createPortal(
        <div className="fixed inset-0 z-[70] grid place-items-center p-4">
          <button aria-label="Stay" onClick={() => setLeaving(null)} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <div className="pop relative flex w-full max-w-sm flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-400">
                <Icon name="lock" size={17} />
              </span>
              <div>
                <h2 className="text-[15px] font-medium">Lock the calendar before you leave</h2>
                <p className="mt-1 text-xs text-muted">The content calendar is still unlocked, so anyone can change it. Lock it once your work is done.</p>
              </div>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex flex-col gap-2">
              <button type="button" disabled={pending} onClick={() => set(true, () => go(leaving))} className="btn-primary justify-center">
                <Icon name="lock" size={14} /> {pending ? "Locking…" : "Lock and leave"}
              </button>
              <button type="button" onClick={() => go(leaving)} className="btn-ghost justify-center">
                Leave it unlocked
              </button>
              <button type="button" onClick={() => setLeaving(null)} className="text-xs text-muted hover:text-ink">
                Stay here
              </button>
            </div>
          </div>
        </div>
,
          document.body
        )}
    </>
  );
}

/* ------------------------------ Calendar ------------------------------ */

const STATUS_TILES = [
  { id: "posted", label: "Posted", buckets: ["posted"], tone: "text-emerald-500", dot: "#059669" },
  { id: "done", label: "To post", buckets: ["done"], tone: "text-sky-500", dot: "#38bdf8" },
  { id: "ready", label: "Ready to share", buckets: ["ready"], tone: "text-emerald-500", dot: "#6ee7b7" },
  { id: "shared", label: "Shared with client", buckets: ["shared"], tone: "text-cyan-500", dot: "#22d3ee" },
  { id: "progress", label: "In progress", buckets: ["progress", "review"], tone: "text-amber-500", dot: "#fbbf24" },
  { id: "unassigned", label: "Not assigned", buckets: ["unassigned"], tone: "text-brand", dot: "" },
];

/**
 * This month's posts at a glance: approved, ready to share, shared with the client, in progress, not
 * assigned. Tap a number to list those posts (date, post, who's on it) — open the post or its task.
 */
export function WorkStatus({ items, monthName, onOpen }) {
  const [pick, setPick] = useState(null);
  if (!items.length) return null;
  const c = countBuckets(items);
  const tile = STATUS_TILES.find((t) => t.id === pick);
  const list = tile ? items.filter((i) => tile.buckets.includes(bucketOf(i))).sort((x, y) => x.publish_on.localeCompare(y.publish_on)) : [];
  return (
    <section className="card !rounded-3xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Where {monthName}&apos;s posts stand · tap a number to see the posts</p>
          <p className="mt-1 flex items-end gap-2">
            <span className="text-[34px] font-light leading-none tabular-nums tracking-[-0.03em]">
              {c.posted}
              <span className="text-[18px] text-faint">/{c.total}</span>
            </span>
            <span className="mb-1 text-[12px] text-muted">posted{c.done ? ` · ${c.done} approved, to post` : ""}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_TILES.map((t) => {
            const v = t.buckets.reduce((n, b) => n + c[b], 0);
            const on = pick === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!v}
                onClick={() => setPick(on ? null : t.id)}
                className={`flex min-w-[124px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[11.5px] transition ${on ? "bg-solid text-on-solid" : "bg-panel-2 text-muted hover:bg-panel-3 disabled:opacity-60 disabled:hover:bg-panel-2"}`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${t.dot ? "" : "hatch border border-line-strong"}`} style={t.dot ? { background: t.dot } : undefined} />
                  {t.label}
                </span>
                <b className={`text-[15px] font-medium tabular-nums ${on ? "" : v ? t.tone : "text-ink"}`}>{v}</b>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <WorkBar c={c} />
      </div>

      {tile && (
        <div className="mt-4 rounded-2xl border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <p className="text-[13px] font-medium">
              {tile.label} <span className="font-normal text-muted">· {list.length}</span>
            </p>
            {pick === "ready" && <p className="hidden text-[11.5px] text-muted sm:block">Open the task, download the files, share them — then press “Shared with client”.</p>}
            <button type="button" onClick={() => setPick(null)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-panel-2" aria-label="Close">
              <Icon name="x" size={12} />
            </button>
          </div>
          <ul>
            {list.map((i) => {
              const st = itemState(i);
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-2.5 last:border-0">
                  <span className="w-24 shrink-0 text-[12px] tabular-nums text-muted">{fmtKey(i.publish_on)}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[i.kind] || "#94a3b8" }} title={taskKindLabel(i.kind)} />
                  <button type="button" onClick={() => onOpen?.(i)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium hover:text-brand">
                    {i.title || taskKindLabel(i.kind)}
                  </button>
                  {i.task?.assignee && (
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      <Avatar name={i.task.assignee.name} size={18} /> {i.task.assignee.name.split(" ")[0]}
                    </span>
                  )}
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${st.color} 16%, transparent)`, color: `color-mix(in oklab, ${st.color} 70%, var(--color-ink))` }}>
                    {st.label}
                  </span>
                  {i.task ? (
                    <Link href={`/tasks/${i.task.id}`} className="flex items-center gap-1 rounded-full bg-solid px-2.5 py-1 text-[11.5px] font-medium text-on-solid hover:opacity-90">
                      {pick === "ready" ? "Download & share" : "Open task"} <Icon name="arrow" size={11} />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => onOpen?.(i)} className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-medium hover:bg-panel-2">
                      Assign
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function ContentCalendar({ brand, month, monthName, items: initial, plan, progress, people = [], canEdit: mayEdit, canAssign, canPlan, lock = { locked: false, ready: false }, canLock = false, canDelete = false }) {
  // A locked calendar can't be changed by anyone (assigning and marking posted still work)
  const canEdit = mayEdit && !lock.locked;
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [synced, setSynced] = useState(initial);
  if (synced !== initial) {
    setSynced(initial);
    setItems(initial);
  }
  const [open, setOpen] = useState(null);
  const [view, setView] = useState("grid");
  const [over, setOver] = useState("");
  const [error, setError] = useState("");
  const [, start] = useTransition();

  const byDay = useMemo(() => {
    const m = {};
    for (const i of items) (m[i.publish_on] ||= []).push(i);
    return m;
  }, [items]);

  const drop = (e, day) => {
    e.preventDefault();
    setOver("");
    const id = e.dataTransfer.getData("text/item");
    const it = items.find((x) => x.id === id);
    if (!it || it.publish_on === day) return;
    setItems((cur) => cur.map((x) => (x.id === id ? { ...x, publish_on: day } : x)));
    start(async () => {
      const res = await moveCalendarItem(id, day);
      if (!res.ok) {
        setError(res.error);
        setItems(initial);
      }
      router.refresh();
    });
  };

  const add = (day) => canEdit && setOpen({ publish_on: day });
  const agenda = Object.keys(byDay).sort();

  return (
    <div className="flex flex-col gap-4">
      <LockBar brandId={brand.id} lock={lock} canLock={canLock} />
      <PlanCard key={`${brand.id}-${month}-${plan?.updated_at || ""}`} brandId={brand.id} month={month} monthName={monthName} plan={plan} progress={progress} canPlan={canPlan} />
      <WorkStatus items={items} monthName={monthName} onOpen={setOpen} />

      <section className="card !rounded-3xl p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
          <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            {CONTENT_KINDS.filter((k) => PLAN_KINDS.includes(k.id)).map((k) => (
              <li key={k.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: KIND_COLOR[k.id] }} />
                {k.label}
              </li>
            ))}
          </ul>
          <nav className="seg flex p-1 text-xs">
            {[
              ["grid", "Month"],
              ["list", "List"],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} data-on={view === k} className="seg-item text-xs">
                {l}
              </button>
            ))}
          </nav>
          {canEdit && canDelete && items.length > 0 && <ClearMonth brandId={brand.id} month={month} monthName={monthName} count={items.length} />}
          {canEdit && <CalendarImport brand={brand} month={month} monthName={monthName} />}
          {canEdit && (
            <button onClick={() => add(todayKey().startsWith(month) ? todayKey() : `${month}-01`)} className="btn-primary btn-sm">
              <Icon name="plus" size={13} /> Add post
            </button>
          )}
        </div>
        {error && <p className="mb-2 px-1 text-xs text-rose-400">{error}</p>}

        {view === "grid" ? (
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <MonthGrid
              month={month}
              byDay={byDay}
              className="min-w-[760px]"
              onDragOverDay={
                canEdit
                  ? (e, day) => {
                      e.preventDefault();
                      if (over !== day) setOver(day);
                    }
                  : undefined
              }
              onDropDay={canEdit ? drop : undefined}
              renderDay={(day, list, { inMonth }) => (
                <div className={`flex min-h-[78px] flex-col gap-1 rounded-lg transition ${over === day ? "bg-brand/10 ring-1 ring-brand/40" : ""}`}>
                  {list.map((i) => (
                    <Chip key={i.id} i={i} onOpen={setOpen} draggable={canEdit} />
                  ))}
                  {canEdit && inMonth && (
                    <button onClick={() => add(day)} className="mt-auto hidden h-6 items-center justify-center rounded-lg text-faint transition hover:bg-panel-2 hover:text-ink group-hover/day:flex" aria-label={`Add on ${day}`}>
                      <Icon name="plus" size={12} />
                    </button>
                  )}
                </div>
              )}
            />
          </div>
        ) : agenda.length ? (
          <ol className="flex flex-col divide-y divide-line">
            {agenda.map((day) => (
              <li key={day} className="flex gap-4 px-1 py-3">
                <div className={`w-16 shrink-0 pt-1 text-xs ${day === todayKey() ? "font-semibold text-brand" : "text-muted"}`}>{fmtKey(day)}</div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {byDay[day].map((i) => {
                    const st = itemState(i);
                    return (
                      <button key={i.id} onClick={() => setOpen(i)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-panel-2">
                        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: KIND_COLOR[i.kind] }} />
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-sm font-medium ${i.status === "posted" ? "line-through opacity-60" : ""}`}>{i.title}</div>
                          <div className="text-xs text-muted">
                            {taskKindLabel(i.kind)} · {platformLabel(i.platform)}
                            {i.task?.assignee && ` · ${i.task.assignee.name.split(" ")[0]}`}
                          </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
                          {st.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="py-12 text-center text-sm text-muted">Nothing planned for {monthName} yet.{canEdit && " Click Add post, or any day on the Month view."}</div>
        )}
      </section>

      {open && <Drawer key={open.id || open.publish_on} item={open} brandId={brand.id} people={people} canEdit={canEdit} canAssign={canAssign} canDelete={canEdit && canDelete} onClose={() => setOpen(null)} />}
    </div>
  );
}
