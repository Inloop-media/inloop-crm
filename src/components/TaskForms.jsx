"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import FileDrop from "@/components/FileDrop";
import DrivePicker from "@/components/DrivePicker";
import { setTaskFolders } from "@/app/(crm)/drive/actions";
import { createClient } from "@/lib/supabase/browser";
import { addTaskFile, addTaskNote, createTask, holdTask, resumeTask, deleteTask, removeTaskFile, reviewTask, setTaskStatus, startTaskUpload, updateTask } from "@/app/(crm)/tasks/actions";
import { MAKER_STATUS_OPTIONS, OPEN_TASK, PRIORITIES, TASK_KINDS, TASK_STATUSES } from "@/lib/constants";

const KIND_GROUP = { head: "Managers / CBOs", design: "Designers", development: "Developers", video: "Video editors", production: "Production", performance: "Performance", social: "Social media", strategy: "Creative strategists", sales: "Sales", execution: "CBO" };
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
    });
  return { pending, error, setError, run };
}

/** Grouped people picker with each person's open-task count. */
export function PersonSelect({ people, value, onChange, kind }) {
  const want = TASK_KINDS.find((k) => k.id === kind)?.group;
  const groups = {};
  for (const p of people) {
    const g = p.kinds.includes("head") ? "head" : (want && p.kinds.includes(want) ? want : p.kinds.find((k) => k !== "execution")) || p.kinds[0] || "other";
    (groups[g] ||= []).push(p);
  }
  const known = [want, "head", "design", "video", "production", "development", "performance", "social", "strategy", "sales", "execution"];
  const order = [...known, ...Object.keys(groups)].filter((g, i, a) => g && a.indexOf(g) === i && groups[g]);
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="">Pick a person…</option>
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

/** High / Medium / Low — high-priority tasks show first on the employee's list. */
export function PrioritySelect({ value, onChange, className = "field" }) {
  return (
    <select className={className} value={value || "medium"} onChange={(e) => onChange(e.target.value)} title="Priority">
      {PRIORITIES.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id === "high" ? "🔴" : p.id === "medium" ? "🟠" : "⚪"} {p.label} priority
        </option>
      ))}
    </select>
  );
}

/* ------------------------------ New task ------------------------------ */

export function NewTaskForm({ brandId, people }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const empty = { title: "", kind: "post", assignee_id: "", due_at: "", brief: "", priority: "medium" };
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
      <div className="grid gap-3 sm:grid-cols-3">
        <PersonSelect people={people} value={f.assignee_id} onChange={set("assignee_id")} kind={f.kind} />
        <input className="field bg-panel" type="datetime-local" value={f.due_at} onChange={set("due_at")} title="Due date" />
        <PrioritySelect value={f.priority} onChange={(v) => setF({ ...f, priority: v })} className="field bg-panel" />
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

/** The one big button for the person doing the task: start it, or submit it for review. */
export function MainAction({ task }) {
  const { pending, error, run } = useRun();
  const s = task.status;
  if (s === "assigned" || s === "revision")
    return (
      <div>
        <button onClick={() => run(() => setTaskStatus(task.id, "in_progress"))} disabled={pending} className="btn-primary w-full justify-center py-3 text-[14px]">
          <Icon name="arrow" size={15} /> {pending ? "Starting…" : s === "revision" ? "Start fixing" : "Start working"}
        </button>
        <p className="mt-2 text-center text-[11.5px] text-muted">Tell your manager you&apos;ve begun</p>
        {error && <p className="mt-2 text-center text-xs text-rose-400">{error}</p>}
      </div>
    );
  if (s === "in_progress")
    return (
      <div>
        <button onClick={() => run(() => setTaskStatus(task.id, "completed"))} disabled={pending} className="btn-primary w-full justify-center py-3 text-[14px]">
          <Icon name="check" size={15} /> {pending ? "Submitting…" : "Submit for review"}
        </button>
        <p className="mt-2 text-center text-[11.5px] text-muted">Add your work first, then submit</p>
        {error && <p className="mt-2 text-center text-xs text-rose-400">{error}</p>}
      </div>
    );
  const msg = { completed: "Submitted — your manager is checking it", client_rejected: "The client asked for changes — your manager will send it back", sent_to_client: "With the client for approval", done: "Approved 🎉", on_hold: "On hold" }[s];
  return msg ? <p className="rounded-xl bg-panel-2 px-4 py-3 text-center text-[13px] font-medium">{msg}</p> : null;
}

/**
 * Pause / resume. Anyone working on it or managing it can put it on hold, but has to say why
 * (e.g. "Urgent Diwali post came in, doing that first"). heldBy: name of who paused it.
 */
export function HoldPanel({ task, heldBy = "" }) {
  const { pending, error, setError, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (task.status === "on_hold")
    return (
      <div className="rounded-2xl bg-amber-500/10 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-amber-600 dark:text-amber-400">
          <Icon name="clock" size={14} /> On hold{heldBy ? ` — paused by ${heldBy.split(" ")[0]}` : ""}
        </p>
        {task.hold_reason && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">“{task.hold_reason}”</p>}
        <button onClick={() => run(() => resumeTask(task.id))} disabled={pending} className="btn-primary btn-sm mt-3">
          <Icon name="arrow" size={13} /> {pending ? "Resuming…" : "Resume task"}
        </button>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>
    );
  if (!OPEN_TASK.includes(task.status)) return null;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink">
        <Icon name="clock" size={14} /> Put on hold
      </button>
    );
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-panel-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length < 3) return setError("Write why it's going on hold.");
        run(() => holdTask(task.id, reason), () => (setOpen(false), setReason("")));
      }}
    >
      <label className="text-[12px] font-medium text-muted" htmlFor={`hold-${task.id}`}>
        Why is it going on hold? (required)
      </label>
      <textarea
        id={`hold-${task.id}`}
        autoFocus
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Urgent Diwali post came in — doing that first"
        className="field resize-y bg-panel text-sm"
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending || !reason.trim()} className="btn-primary btn-sm">
          {pending ? "Saving…" : "Put on hold"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Deliverable files per revision, upload + link. */
export function TaskFiles({ task, canUpload }) {
  const { pending, error, setError, run } = useRun();
  const fileRef = useRef(null);
  const [progress, setProgress] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const locked = ["sent_to_client", "done"].includes(task.status);
  const byRev = {};
  // The assigner's reference files show with the brief, not here
  for (const f of task.files.filter((x) => x.role !== "reference")) (byRev[f.revision] ||= []).push(f);
  // Written notes, per version, oldest first
  const notesBy = {};
  for (const e of [...(task.events || [])].reverse()) if (e.type === "note") (notesBy[Number(e.data?.revision) || 0] ||= []).push(e);
  const revs = [...new Set([...Object.keys(byRev), ...Object.keys(notesBy)].map(Number))].sort((a, b) => b - a);

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
      {revs.length === 0 && !(canUpload && !locked) && <p className="well-empty rounded-2xl p-6 text-center text-sm text-muted">Nothing added yet.</p>}
      {revs.map((r) => (
        <div key={r}>
          <div className="mb-2 text-xs font-medium text-muted">{r === 0 ? "First version" : `Revision ${r}`}{r === task.revision ? " · current" : ""}</div>
          {(notesBy[r] || []).map((n) => (
            <div key={n.id} className="mb-2 rounded-2xl bg-panel-2 px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.data?.text}</p>
              <p className="mt-1 text-[11px] text-faint">
                Note · {n.actor?.name || "—"} · {new Date(n.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(byRev[r] || []).map((f) => (
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

      {/* Drop files anywhere on the task page */}
      <FileDrop enabled={canUpload && !locked && !progress && !(task.folders || []).length} onFiles={upload} label={task.revision ? `Drop revision ${task.revision} to upload` : "Drop your work to upload"} hint="Images, videos, PDFs — up to 50 MB each" />
      {canUpload && !locked && (
        // Drop zone: drag files in, or use the buttons
        // (dropping is handled page-wide by FileDrop above)
        <div className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-panel-2/40 px-6 text-center transition ${revs.length ? "py-5" : "py-10"}`}>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files?.length && upload([...e.target.files])} />
          {!revs.length && (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                <Icon name="upload" size={20} />
              </span>
              <div>
                <p className="text-[14px] font-medium">{progress || ((task.folders || []).length ? "Upload into the Drive folders above" : task.revision ? `Drop revision ${task.revision} here` : "Drop your files here")}</p>
                <p className="mt-0.5 text-[12px] text-muted">{(task.folders || []).length ? "Or add a link / a note here" : "Images, videos, PDFs — up to 50 MB each"}</p>
              </div>
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {/* With Drive folders, files go up from the folders above */}
            {!(task.folders || []).length && (
            <button onClick={() => fileRef.current?.click()} disabled={Boolean(progress) || pending} className="btn-ghost btn-sm bg-panel">
              <Icon name="upload" size={13} /> {progress ? "Uploading…" : revs.length ? "Upload more" : "Browse files"}
            </button>
            )}
            <button onClick={() => setShowLink((v) => !v)} className="btn-ghost btn-sm bg-panel">
              <Icon name="link" size={13} /> Add a link
            </button>
            <button onClick={() => setShowNote((v) => !v)} className="btn-ghost btn-sm bg-panel">
              <Icon name="brief" size={13} /> Write a note
            </button>
          </div>
        </div>
      )}
      {showNote && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addTaskNote(task.id, noteText), () => (setNoteText(""), setShowNote(false)));
          }}
        >
          <textarea
            autoFocus
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="What did you do? e.g. Spoke to the printer, final files sent to them on mail."
            className="field resize-y text-sm"
          />
          <div className="flex gap-2">
            <button disabled={!noteText.trim() || pending} className="btn-primary btn-sm">
              Save note
            </button>
            <button type="button" onClick={() => setShowNote(false)} className="btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
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
        <button onClick={() => run(() => reviewTask(task.id, "ready"))} disabled={pending} className="btn-primary justify-center">
          <Icon name="check" size={14} /> Approve — ready for the client
        </button>
        <button onClick={() => run(() => reviewTask(task.id, "approve"))} disabled={pending} className="btn-ghost justify-center">
          Approve (no client needed)
        </button>
        <textarea className="field resize-y" rows={3} placeholder="Or send it back — what should change?" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={() => run(() => reviewTask(task.id, "send_back", { feedback: note }), () => setNote(""))} disabled={pending || !note.trim()} className="btn-ghost self-start">
          <Icon name="refresh" size={14} /> Send back for revision
        </button>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );

  if (s === "ready" || s === "sent_to_client")
    return (
      <div className="flex flex-col gap-3">
        {s === "ready" ? (
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2.5 text-[13px] text-emerald-700 dark:text-emerald-300">
            Approved by the team — <b className="font-semibold">ready to share</b>. Download the files from the work above and send them to the client, then:
          </p>
        ) : (
          <p className="rounded-xl bg-cyan-500/10 px-3 py-2.5 text-[13px] text-cyan-700 dark:text-cyan-300">Shared with the client. When they reply:</p>
        )}
        {s === "ready" && (
          <button onClick={() => run(() => reviewTask(task.id, "share_client"))} disabled={pending} className="btn-primary justify-center">
            <Icon name="arrow" size={14} /> Shared with client
          </button>
        )}
        <button onClick={() => run(() => reviewTask(task.id, "client_ok"))} disabled={pending} className={`${s === "ready" ? "btn-ghost" : "btn-primary"} justify-center`}>
          <Icon name="check" size={14} /> Client approved
        </button>
        <textarea className="field resize-y" rows={3} placeholder="Client wants changes — what did they say?" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={() => run(() => reviewTask(task.id, "client_changes", { feedback: note }), () => setNote(""))} disabled={pending || !note.trim()} className="btn-ghost self-start">
          <Icon name="refresh" size={14} /> Send back for revision
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

/** Edit the task (title, type, brief, assignee, due, priority) or delete it — for the head. The person doing it is told what changed. */
export function TaskAdmin({ task, people }) {
  const router = useRouter();
  const { pending, error, run } = useRun();
  const [title, setTitle] = useState(task.title || "");
  const [kind, setKind] = useState(task.kind || "other");
  const [brief, setBrief] = useState(task.brief || "");
  const [due, setDue] = useState(toLocal(task.due_at));
  const [assignee, setAssignee] = useState(task.assignee_id || "");
  const [priority, setPriority] = useState(task.priority || "medium");
  const [saved, setSaved] = useState(false);
  const startFolders = (task.folders || []).map((f) => ({ drive_id: f.drive_id, path: f.path, note: f.note || "" }));
  const [folders, setFolders] = useState(startFolders);
  const foldersChanged = JSON.stringify(folders) !== JSON.stringify(startFolders);
  const patch = {
    ...(title.trim() !== task.title ? { title } : {}),
    ...(kind !== task.kind ? { kind } : {}),
    ...(brief.trim() !== (task.brief || "").trim() ? { brief } : {}),
    ...(due !== toLocal(task.due_at) ? { due_at: due } : {}),
    ...(priority !== (task.priority || "medium") ? { priority } : {}),
    ...(assignee !== (task.assignee_id || "") ? { assignee_id: assignee } : {}),
  };
  const changed = Object.keys(patch).length > 0 || foldersChanged;
  // Posting tasks come from the calendar and shoots from a request — their type stays as it is
  const fixedKind = ["posting", "shoot"].includes(task.kind);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Title</span>
        <input className="field" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {!fixedKind && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Type</span>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            {TASK_KINDS.filter((k) => !["posting", "shoot"].includes(k.id)).map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Brief</span>
        <textarea className="field resize-y" rows={4} maxLength={8000} placeholder="Copy, references, sizes, links…" value={brief} onChange={(e) => setBrief(e.target.value)} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Google Drive folders</span>
        <DrivePicker brandId={task.brand_id} value={folders} onChange={setFolders} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Assigned to</span>
        <PersonSelect people={people} value={assignee} onChange={setAssignee} kind={kind} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Due</span>
        <input className="field" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Priority</span>
        <PrioritySelect value={priority} onChange={setPriority} />
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (!title.trim()) return;
            run(
              async () => {
                if (foldersChanged) {
                  const f = await setTaskFolders(task.id, folders);
                  if (!f.ok) return f;
                }
                return Object.keys(patch).length ? updateTask(task.id, patch) : { ok: true };
              },
              () => (setSaved(true), setTimeout(() => setSaved(false), 4000)),
            );
          }}
          disabled={pending || !changed || !title.trim()}
          className="btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !changed && (
          <span className="flex items-center gap-1 text-xs text-emerald-500">
            <Icon name="check" size={12} /> Saved{task.assignee?.name ? ` · ${task.assignee.name.split(" ")[0]} is notified` : ""}
          </span>
        )}
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
