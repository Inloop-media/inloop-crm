"use client";
// "Assign a task" from anywhere: a modal with brand, what, who and when. Press N to open it.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { PersonSelect, PrioritySelect } from "@/components/TaskForms";
import { createTask } from "@/app/(crm)/tasks/actions";
import { TASK_KINDS } from "@/lib/constants";

export default function QuickAssign({ brands, people, defaultBrand = "", label = "Assign a task", className = "btn-primary btn-sm" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const empty = { brand: defaultBrand, title: "", kind: "post", assignee_id: "", due_at: "", brief: "", priority: "medium" };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });

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

  const submit = (e, again) => {
    e.preventDefault();
    start(async () => {
      setError("");
      const res = await createTask(f.brand, f);
      if (!res.ok) return setError(res.error);
      setDone(f.title);
      router.refresh();
      if (again) setF({ ...empty, brand: f.brand, kind: f.kind, assignee_id: f.assignee_id, due_at: f.due_at });
      else {
        setF({ ...empty, brand: f.brand });
        setOpen(false);
      }
    });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={className} title="Assign a task (N)">
        <Icon name="plus" size={13} /> {label}
        <kbd className="ml-1 hidden rounded bg-black/15 px-1 text-[10px] font-medium sm:inline">N</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:pt-[12vh]">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          <form onSubmit={(e) => submit(e, false)} className="pop relative flex max-h-[90svh] w-full max-w-lg flex-col gap-4 overflow-y-auto !rounded-b-none p-5 sm:!rounded-3xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Assign a task</h2>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-panel-2" aria-label="Close">
                <Icon name="x" size={14} />
              </button>
            </div>
            {done && <p className="rounded-xl bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400">Assigned “{done}”. Add another or close.</p>}
            <select className="field" value={f.brand} onChange={set("brand")} required>
              <option value="">Which brand?</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input className="field" placeholder="What needs to be made? e.g. Diwali offer post" value={f.title} onChange={set("title")} required autoFocus />
            <div className="flex flex-wrap gap-1.5">
              {TASK_KINDS.map((k) => (
                <button key={k.id} type="button" onClick={() => setF({ ...f, kind: k.id })} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${f.kind === k.id ? "solid" : "bg-panel-2 text-muted hover:text-ink"}`}>
                  {k.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <PersonSelect people={people} value={f.assignee_id} onChange={set("assignee_id")} kind={f.kind} />
              <input className="field" type="datetime-local" value={f.due_at} onChange={set("due_at")} title="Due date" />
              <PrioritySelect value={f.priority} onChange={(v) => setF({ ...f, priority: v })} />
            </div>
            <textarea className="field resize-y" rows={3} placeholder="Brief: copy, references, sizes…" value={f.brief} onChange={set("brief")} />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" disabled={pending || !f.brand || !f.title || !f.assignee_id} onClick={(e) => submit(e, true)} className="btn-ghost btn-sm">
                Assign & add another
              </button>
              <button disabled={pending || !f.brand || !f.title || !f.assignee_id} className="btn-primary btn-sm">
                {pending ? "Assigning…" : "Assign"} <Icon name="arrow" size={13} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
