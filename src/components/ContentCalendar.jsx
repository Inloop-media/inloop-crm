"use client";
// One brand's content calendar for a month: the plan on top, then a month grid (or an agenda list on
// phones). Click a day to add a post, click a post to edit it, drag it to move it. Heads turn a post
// into a task for someone straight from here.
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import MonthGrid, { todayKey } from "@/components/MonthGrid";
import { PersonSelect } from "@/components/TaskForms";
import { assignCalendarItem, deleteCalendarItem, moveCalendarItem, saveCalendarItem, savePlan, setCalendarPosted } from "@/app/(crm)/calendar/actions";
import { PLAN_KINDS, PLATFORMS, TASK_KINDS, TASK_STATUSES, kindPlural, taskKindLabel } from "@/lib/constants";

export const KIND_COLOR = { post: "#60a5fa", carousel: "#a78bfa", story: "#f472b6", reel: "#fbbf24", video: "#22d3ee", design: "#4ade80", website: "#94a3b8", other: "#94a3b8" };
const CONTENT_KINDS = TASK_KINDS.filter((k) => k.id !== "website");
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtKey = (k) => dayFmt.format(new Date(`${k}T00:00:00Z`));

/** Where an item stands, in one word. */
export function itemState(i) {
  if (i.status === "posted") return { label: "Posted", color: "#4ade80" };
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
      <span className={`min-w-0 flex-1 truncate ${i.status === "posted" ? "line-through" : ""}`}>{i.title}</span>
      <span className="shrink-0 text-[9px] font-semibold uppercase opacity-60">{taskKindLabel(i.kind).slice(0, 4)}</span>
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
            <h3 className="text-sm font-medium">Plan for {monthName}</h3>
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
            {pending ? "Saving…" : "Save plan"}
          </button>
        </div>
      </form>
    );

  return (
    <section className="card !rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">
            {monthName} plan
            {plan?.inherited && <span className="ml-2 rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-normal text-muted">same as last month</span>}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {progress.target ? (
              <>
                <b className="font-medium text-ink">{progress.planned}</b> of {progress.target} planned · <b className="font-medium text-ink">{progress.assigned}</b> assigned · <b className="font-medium text-ink">{progress.done}</b> done
              </>
            ) : canPlan ? (
              "No plan yet — set how many posts, reels and stories this brand gets."
            ) : (
              "No plan set for this month yet."
            )}
          </p>
          {plan?.notes && <p className="mt-2 max-w-2xl whitespace-pre-line text-xs text-muted">{plan.notes}</p>}
        </div>
        {canPlan && (
          <button onClick={() => setEditing(true)} className="btn-ghost btn-sm">
            <Icon name="board" size={13} /> {progress.target ? "Edit plan" : "Set plan"}
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

function Drawer({ item, brandId, people, canEdit, canAssign, onClose }) {
  const { pending, error, run } = useRun();
  const isNew = !item.id;
  const [f, setF] = useState({ title: item.title || "", kind: item.kind || "post", platform: item.platform || "instagram", publish_on: item.publish_on, caption: item.caption || "", notes: item.notes || "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [who, setWho] = useState("");
  const twoDaysBefore = (() => {
    const d = new Date(`${f.publish_on}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 2);
    const k = d.toISOString().slice(0, 10);
    return k < todayKey() ? todayKey() : k;
  })();
  const [due, setDue] = useState(twoDaysBefore);
  const st = itemState(item);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-panel shadow-2xl">
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
            run(() => saveCalendarItem({ ...f, id: item.id, brand_id: brandId }), onClose);
          }}
        >
          <fieldset disabled={!canEdit} className="flex flex-col gap-4">
            <div>
              <label className="label">Topic / title</label>
              <input className="field" value={f.title} onChange={set("title")} placeholder="e.g. Diwali offer — 20% off" required autoFocus={isNew} />
            </div>
            <div>
              <label className="label">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {CONTENT_KINDS.map((k) => (
                  <button key={k.id} type="button" onClick={() => setF({ ...f, kind: k.id })} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${f.kind === k.id ? "solid" : "bg-panel-2 text-muted hover:text-ink"}`}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COLOR[k.id] }} />
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Goes out on</label>
                <input type="date" className="field" value={f.publish_on} onChange={set("publish_on")} required />
              </div>
              <div>
                <label className="label">Platform</label>
                <select className="field" value={f.platform} onChange={set("platform")}>
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Caption</label>
              <textarea className="field resize-y" rows={5} value={f.caption} onChange={set("caption")} placeholder="The caption, hashtags, CTA…" />
            </div>
            <div>
              <label className="label">Notes for the designer / editor</label>
              <textarea className="field resize-y" rows={3} value={f.notes} onChange={set("notes")} placeholder="References, visual idea, text on the creative…" />
            </div>
          </fieldset>

          {!isNew && (
            <section className="well flex flex-col gap-3 p-4">
              <h3 className="text-xs font-medium text-muted">Production</h3>
              {item.task ? (
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
                  </div>
                  <button type="button" disabled={!who || pending} onClick={() => run(() => assignCalendarItem(item.id, { assignee_id: who, due_at: due }), onClose)} className="btn-primary btn-sm self-start">
                    <Icon name="tasks" size={13} /> Assign as task
                  </button>
                  <p className="text-[11px] text-muted">The caption and notes go into the task brief.</p>
                </div>
              ) : (
                <p className="text-xs text-muted">Not assigned yet — the execution heads assign it to a designer or editor.</p>
              )}
              {canEdit && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={item.status === "posted"} onChange={(e) => run(() => setCalendarPosted(item.id, e.target.checked))} className="h-4 w-4 accent-[var(--color-brand)]" />
                  Posted
                </label>
              )}
            </section>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </form>

        {canEdit && (
          <footer className="flex items-center gap-2 border-t border-line px-5 py-4">
            {!isNew && (
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm("Delete this post from the calendar?") && run(() => deleteCalendarItem(item.id), onClose)}
                className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-rose-400/10 hover:text-rose-400"
                aria-label="Delete"
              >
                <Icon name="trash" size={15} />
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

/* ------------------------------ Calendar ------------------------------ */

export default function ContentCalendar({ brand, month, monthName, items: initial, plan, progress, people = [], canEdit, canAssign, canPlan }) {
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
      <PlanCard key={`${brand.id}-${month}-${plan?.updated_at || ""}`} brandId={brand.id} month={month} monthName={monthName} plan={plan} progress={progress} canPlan={canPlan} />

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
                            {taskKindLabel(i.kind)} · {PLATFORMS.find((p) => p.id === i.platform)?.label}
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

      {open && <Drawer key={open.id || open.publish_on} item={open} brandId={brand.id} people={people} canEdit={canEdit} canAssign={canAssign} onClose={() => setOpen(null)} />}
    </div>
  );
}
