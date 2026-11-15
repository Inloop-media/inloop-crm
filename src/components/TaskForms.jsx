"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/browser";
import { addTaskFile, createTask, deleteTask, removeTaskFile, reviewTask, setTaskStatus, startTaskUpload, updateTask } from "@/app/(crm)/tasks/actions";
import { MAKER_STATUS_OPTIONS, TASK_KINDS, TASK_STATUSES } from "@/lib/constants";

const KIND_GROUP = { design: "Designers", development: "Developers", video: "Video editors", execution: "Execution heads" };
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isImg = (n) => /\.(jpe?g|png|webp|gif)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");

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

/** Grouped people picker with each person's open-task count. */
export function PersonSelect({ people, value, onChange, kind }) {
  const want = TASK_KINDS.find((k) => k.id === kind)?.group;
  const groups = {};
  for (const p of people) {
    const g = (want && p.kinds.includes(want) ? want : p.kinds.find((k) => k !== "execution")) || p.kinds[0];
    (groups[g] ||= []).push(p);
  }
  const order = [want, "design", "video", "development", "execution"].filter((g, i, a) => g && a.indexOf(g) === i && groups[g]);
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="">Assign to…</option>
      {order.map((g) => (
        <optgroup key={g} label={KIND_GROUP[g] || g}>
          {groups[g].map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.open} open
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600000);
  return d.toISOString().slice(0, 16);
};

/* ------------------------------ New task ------------------------------ */

export function NewTaskForm({ brandId, people }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const empty = { title: "", kind: "post", assignee_id: "", due_at: "", brief: "" };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Icon name="plus" size={14} /> New task
      </button>
    );
  return (
    <form
      className="tint-lavender flex w-full flex-col gap-3 rounded-2xl p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createTask(brandId, f), () => setF({ ...empty, kind: f.kind, assignee_id: f.assignee_id }));
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">New task</span>
        <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-panel" aria-label="Close">
          <Icon name="x" size={14} />
        </button>
      </div>
      <input className="field bg-panel" placeholder="What needs to be made? e.g. Diwali offer post" value={f.title} onChange={set("title")} required autoFocus />
      <div className="flex flex-wrap gap-1.5">
        {TASK_KINDS.map((k) => (
          <button key={k.id} type="button" onClick={() => setF({ ...f, kind: k.id })} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${f.kind === k.id ? "solid" : "bg-panel text-muted hover:text-ink"}`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PersonSelect people={people} value={f.assignee_id} onChange={set("assignee_id")} kind={f.kind} />
        <input className="field bg-panel" type="datetime-local" value={f.due_at} onChange={set("due_at")} title="Due date" />
      </div>
      <textarea className="field resize-y bg-panel" rows={3} placeholder="Brief: copy, references, sizes, anything they need" value={f.brief} onChange={set("brief")} />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex justify-end">
        <button disabled={pending || !f.title || !f.assignee_id} className="btn-primary">
          {pending ? "Assigning…" : "Assign task"} <Icon name="arrow" size={14} />
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ Employee ------------------------------ */

/** The status dropdown the employee uses: To do / In progress / Completed. */
export function StatusSelect({ task, canChange }) {
  const { pending, error, run } = useRun();
  const editable = canChange && ["assigned", "in_progress", "revision", "completed"].includes(task.status);
  const current = task.status === "revision" ? "assigned" : task.status;
  if (!editable)
    return (
      <div className="text-sm">
        <span className="font-medium">{TASK_STATUSES[task.status]?.label}</span>
      </div>
    );
  return (
    <div>
      <select
        className="field font-medium"
        value={current}
        disabled={pending}
        onChange={(e) => run(() => setTaskStatus(task.id, e.target.value))}
      >
        {MAKER_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s === "assigned" && task.revision ? `Revision ${task.revision} — to do` : TASK_STATUSES[s].label.replace(" — in review", "")}
          </option>
        ))}
      </select>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

/** Deliverable files per revision, upload + link. */
export function TaskFiles({ task, canUpload }) {
  const { pending, error, setError, run } = useRun();
  const fileRef = useRef(null);
  const [progress, setProgress] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const locked = ["sent_to_client", "done"].includes(task.status);
  const byRev = {};
  for (const f of task.files) (byRev[f.revision] ||= []).push(f);
  const revs = Object.keys(byRev).map(Number).sort((a, b) => b - a);

  const upload = async (files) => {
    setError("");
    for (const [i, file] of files.entries()) {
      setProgress(files.length > 1 ? `Uploading ${i + 1} of ${files.length} — ${file.name}…` : `Uploading ${file.name}…`);
      const s = await startTaskUpload(task.id, file.name, file.size);
      if (!s.ok) {
        setError(s.error);
        break;
      }
      const { error: upErr } = await createClient().storage.from("lead-docs").uploadToSignedUrl(s.path, s.token, file, { contentType: file.type || undefined });
      if (upErr) {
        setError(upErr.message);
        break;
      }
      const r = await addTaskFile(task.id, { path: s.path, name: file.name, size: file.size });
      if (!r.ok) {
        setError(r.error);
        break;
      }
    }
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
    run(async () => ({ ok: true }));
  };

  return (
    <div className="flex flex-col gap-4">
      {revs.length === 0 && <p className="well-empty rounded-2xl p-6 text-center text-sm text-muted">No files yet{canUpload ? " — upload the work when it's ready." : "."}</p>}
      {revs.map((r) => (
        <div key={r}>
          <div className="mb-2 text-xs font-medium text-muted">{r === 0 ? "First version" : `Revision ${r}`}{r === task.revision ? " · current" : ""}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {byRev[r].map((f) => (
              <div key={f.id} className="group relative overflow-hidden rounded-2xl bg-panel-2">
                <a href={f.href} target="_blank" rel="noreferrer" className="block">
                  {isImg(f.name) && f.href ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                    <img src={f.href} alt={f.name} loading="lazy" className="aspect-square w-full object-cover" />
                  ) : isVid(f.name) && f.href ? (
                    <video src={f.href} className="aspect-square w-full bg-black object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <div className="grid aspect-square place-items-center text-muted">
                      <Icon name={f.storage_path ? "file" : "link"} size={22} />
                    </div>
                  )}
                  <div className="truncate px-3 py-2 text-xs">
                    {f.name}
                    {f.size > 0 && <span className="text-faint"> · {kb(f.size)}</span>}
                  </div>
                </a>
                {!locked && canUpload && (
                  <button
                    onClick={() => run(() => removeTaskFile(f.id))}
                    disabled={pending}
                    title="Remove"
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white opacity-0 transition hover:bg-rose-500 group-hover:opacity-100"
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {canUpload && !locked && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files?.length && upload([...e.target.files])} />
          <button onClick={() => fileRef.current?.click()} disabled={Boolean(progress) || pending} className="btn-ghost">
            <Icon name="upload" size={14} /> {progress ? "Uploading…" : task.revision ? `Upload revision ${task.revision}` : "Upload work"}
          </button>
          <button onClick={() => setShowLink((v) => !v)} className="px-1 text-xs text-muted hover:text-ink">
            or add a link (big videos, Figma, site)
          </button>
        </div>
      )}
      {showLink && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addTaskFile(task.id, { url: link }), () => (setLink(""), setShowLink(false)));
          }}
        >
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="field py-2 text-sm" />
          <button disabled={!link || pending} className="btn-primary btn-sm shrink-0">
            Add
          </button>
        </form>
      )}
      {progress && <p className="text-xs text-muted">{progress}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

/* ------------------------------ Head ------------------------------ */

/** Review / client / reassign controls for the execution head. */
export function ReviewPanel({ task, people }) {
  const { pending, error, run } = useRun();
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState(task.assignee_id || "");
  const [due, setDue] = useState("");
  const s = task.status;

  if (s === "completed")
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{task.assignee?.name || "They"} marked this completed. Check the files, then:</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => run(() => reviewTask(task.id, "share_client"))} disabled={pending} className="btn-primary">
            <Icon name="arrow" size={14} /> Share with client
          </button>
          <button onClick={() => run(() => reviewTask(task.id, "approve"))} disabled={pending} className="btn-ghost">
            <Icon name="check" size={14} /> Approve (no client approval needed)
          </button>
        </div>
        <textarea className="field resize-y" rows={3} placeholder="Or send it back — what should change?" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={() => run(() => reviewTask(task.id, "send_back", { feedback: note }), () => setNote(""))} disabled={pending || !note.trim()} className="btn-ghost self-start">
          <Icon name="refresh" size={14} /> Send back for revision
        </button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );

  if (s === "sent_to_client")
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">It&apos;s on the client&apos;s dashboard for approval. If they answered on a call or WhatsApp, record it here:</p>
        <button onClick={() => run(() => reviewTask(task.id, "client_ok"))} disabled={pending} className="btn-primary self-start">
          <Icon name="check" size={14} /> Client approved
        </button>
        <textarea className="field resize-y" rows={3} placeholder="Client wants changes — what did they say?" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={() => run(() => reviewTask(task.id, "client_changes", { feedback: note }), () => setNote(""))} disabled={pending || !note.trim()} className="btn-ghost self-start">
          Client asked for changes
        </button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );

  if (s === "client_rejected")
    return (
      <div className="flex flex-col gap-3">
        <div className="tint-pink rounded-2xl p-4">
          <div className="text-xs font-medium text-ink/60">Client feedback</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{task.feedback}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <PersonSelect people={people} value={assignee} onChange={setAssignee} kind={task.kind} />
          <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} title="New due date (optional)" />
        </div>
        <textarea className="field resize-y" rows={2} placeholder="Add a note for them (optional — the client's feedback goes along)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          onClick={() => run(() => reviewTask(task.id, "reassign", { feedback: note ? `${task.feedback}\n\n${note}` : task.feedback, assignee_id: assignee, due_at: due }))}
          disabled={pending || !assignee}
          className="btn-primary self-start"
        >
          <Icon name="refresh" size={14} /> {assignee === task.assignee_id ? `Send back to ${task.assignee?.name || "them"}` : "Reassign revision"}
        </button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );

  return <p className="text-sm text-muted">{s === "done" ? "Approved and done." : `With ${task.assignee?.name || "the team"} — you'll be notified when it's completed.`}</p>;
}

/** Edit due date / assignee / delete — for the head. */
export function TaskAdmin({ task, people }) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [due, setDue] = useState(toLocal(task.due_at));
  const [assignee, setAssignee] = useState(task.assignee_id || "");
  const changed = due !== toLocal(task.due_at) || assignee !== (task.assignee_id || "");
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Assigned to</span>
        <PersonSelect people={people} value={assignee} onChange={setAssignee} kind={task.kind} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Due</span>
        <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => run(() => updateTask(task.id, { due_at: due, ...(assignee !== task.assignee_id ? { assignee_id: assignee } : {}) }))}
          disabled={pending || !changed}
          className="btn-ghost btn-sm"
        >
          Save
        </button>
        <button
          onClick={() => {
            if (confirm("Delete this task and its files? This can't be undone.")) run(() => deleteTask(task.id), () => router.push(`/brands/${task.brand_id}`));
          }}
          disabled={pending}
          className="ml-auto px-1 text-xs text-muted hover:text-rose-400"
        >
          Delete task
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
