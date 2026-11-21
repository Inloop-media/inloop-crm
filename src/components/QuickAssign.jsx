"use client";
// "New task" from anywhere: what, which brand, who, by when. Press N to open it.
// Every field has a label; the due date and priority are one tap; the brief is tucked away until needed.
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { PersonSelect } from "@/components/TaskForms";
import { createTask } from "@/app/(crm)/tasks/actions";
import { TASK_KINDS } from "@/lib/constants";

const MAIN_KINDS = ["post", "carousel", "story", "reel", "video"];
const PRIORITY = [
  ["low", "Low"],
  ["medium", "Normal"],
  ["high", "Urgent"],
];

/** "2026-11-22T19:00" in India time, `days` from today. */
function dueIn(days) {
  const d = new Date(Date.now() + days * 864e5);
  return `${d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T19:00`;
}
const DUE = [
  ["Today", 0],
  ["Tomorrow", 1],
  ["In 3 days", 3],
  ["In a week", 7],
];

function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-muted">
      {children}
    </label>
  );
}

function Chip({ on, onClick, children, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${on ? (danger ? "bg-rose-500 text-white" : "solid") : "bg-panel-2 text-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

export default function QuickAssign({ brands, people, defaultBrand = "", label = "New task", className = "btn-primary btn-sm" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const empty = { brand: defaultBrand, title: "", kind: "post", assignee_id: "", due_at: dueIn(1), brief: "", priority: "medium" };
  const [f, setF] = useState(empty);
  const [moreKinds, setMoreKinds] = useState(false);
  const [pickDate, setPickDate] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e?.target ? e.target.value : e }));
  const who = people.find((p) => p.id === f.assignee_id);
  const ready = f.brand && f.title.trim() && f.assignee_id;

  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === "Escape") setOpen(false);
      if (!typing && !e.metaKey && !e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setError("");
    setDone("");
  };

  const submit = (e, again) => {
    e.preventDefault();
    if (!ready) return setError(!f.title.trim() ? "Write what needs to be made." : !f.brand ? "Pick the brand." : "Pick who does it.");
    start(async () => {
      setError("");
      const res = await createTask(f.brand, f);
      if (!res.ok) return setError(res.error);
      setDone(`“${f.title}” given to ${who?.name.split(" ")[0] || "them"}.`);
      router.refresh();
      if (again) setF({ ...empty, brand: f.brand, kind: f.kind, assignee_id: f.assignee_id, due_at: f.due_at, priority: f.priority });
      else {
        setF({ ...empty, brand: f.brand });
        setOpen(false);
        setDone("");
      }
    });
  };

  const kinds = TASK_KINDS.filter((k) => moreKinds || MAIN_KINDS.includes(k.id) || k.id === f.kind);
  const quick = DUE.find(([, d]) => dueIn(d) === f.due_at);

  return (
    <>
      <button onClick={() => setOpen(true)} className={className} title="New task (N)">
        <Icon name="plus" size={13} /> {label}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
            <form onSubmit={(e) => submit(e, false)} className="pop relative flex max-h-[92svh] w-full max-w-[520px] flex-col overflow-hidden !rounded-b-none sm:!rounded-3xl">
              <header className="flex items-center justify-between border-b border-line px-6 py-4">
                <h2 className="text-[16px] font-medium">New task</h2>
                <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-panel-2" aria-label="Close">
                  <Icon name="x" size={14} />
                </button>
              </header>

              <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
                {done && (
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-600 dark:text-emerald-400">
                    <Icon name="check" size={14} /> {done} Add the next one.
                  </p>
                )}

                <div>
                  <Label htmlFor="qa-title">What needs to be made</Label>
                  <input id="qa-title" className="field" placeholder="Diwali offer reel" value={f.title} onChange={set("title")} autoFocus />
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {kinds.map((k) => (
                      <Chip key={k.id} on={f.kind === k.id} onClick={() => setF((v) => ({ ...v, kind: k.id }))}>
                        {k.label}
                      </Chip>
                    ))}
                    {!moreKinds && (
                      <button type="button" onClick={() => setMoreKinds(true)} className="rounded-full px-2.5 py-1.5 text-[12.5px] text-muted hover:text-ink">
                        More…
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="qa-brand">Brand</Label>
                    <select id="qa-brand" className="field" value={f.brand} onChange={set("brand")}>
                      <option value="">Pick a brand…</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Who does it</Label>
                    <PersonSelect people={people} value={f.assignee_id} onChange={set("assignee_id")} kind={f.kind} />
                  </div>
                </div>

                <div>
                  <Label>Due</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DUE.map(([l, d]) => (
                      <Chip
                        key={l}
                        on={!pickDate && quick?.[0] === l}
                        onClick={() => {
                          setPickDate(false);
                          setF((v) => ({ ...v, due_at: dueIn(d) }));
                        }}
                      >
                        {l}
                      </Chip>
                    ))}
                    <Chip on={pickDate || (!quick && !!f.due_at)} onClick={() => setPickDate(true)}>
                      <Icon name="calendar" size={12} className="mr-1 inline" />
                      Pick date
                    </Chip>
                  </div>
                  {(pickDate || (!quick && f.due_at)) && <input type="datetime-local" className="field mt-2" value={f.due_at} onChange={set("due_at")} />}
                  {!pickDate && quick && <p className="mt-1.5 text-[11.5px] text-faint">By 7 pm</p>}
                </div>

                <div>
                  <Label>Priority</Label>
                  <div className="flex gap-1.5">
                    {PRIORITY.map(([id, l]) => (
                      <Chip key={id} on={f.priority === id} danger={id === "high"} onClick={() => setF((v) => ({ ...v, priority: id }))}>
                        {l}
                      </Chip>
                    ))}
                  </div>
                </div>

                {showBrief ? (
                  <div>
                    <Label htmlFor="qa-brief">Brief</Label>
                    <textarea id="qa-brief" className="field resize-y" rows={4} placeholder="Copy, references, sizes, links…" value={f.brief} onChange={set("brief")} autoFocus />
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowBrief(true)} className="flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink">
                    <Icon name="plus" size={13} /> Add a brief (copy, references, links)
                  </button>
                )}

                {error && <p className="text-[13px] text-rose-500">{error}</p>}
              </div>

              <footer className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
                <button type="button" disabled={pending} onClick={(e) => submit(e, true)} className="text-[12.5px] text-muted hover:text-ink">
                  Assign & add another
                </button>
                <span className="flex-1" />
                <button type="button" onClick={close} className="btn-ghost btn-sm">
                  Cancel
                </button>
                <button disabled={pending} className="btn-primary btn-sm">
                  {pending ? "Assigning…" : who ? `Assign to ${who.name.split(" ")[0]}` : "Assign"} <Icon name="arrow" size={13} />
                </button>
              </footer>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
