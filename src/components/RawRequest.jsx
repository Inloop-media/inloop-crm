"use client";
// "Need raw photos or footage?" on a design / video task: a manager asks Production (Aryan's team) for
// a shoot with a brief, references and a date. Production gets a "shoot" task linked to this one; when
// they upload and submit, this task's designer / editor gets a notification and the files show here.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { addTaskFile, requestRaw, startTaskUpload } from "@/app/(crm)/tasks/actions";
import { createClient } from "@/lib/supabase/browser";
import { RAW_WHAT } from "@/lib/constants";

function dueIn(days) {
  const d = new Date(Date.now() + days * 864e5);
  return `${d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T19:00`;
}
const DUE = [
  ["Today", 0],
  ["Tomorrow", 1],
  ["In 2 days", 2],
  ["In 3 days", 3],
];

function Chip({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${on ? "solid" : "bg-panel-2 text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

export default function RawRequest({ task, crew = [] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const video = ["reel", "video"].includes(task.kind);
  const lead = crew.find((p) => p.lead) || crew[0];
  const blank = () => ({ what: video ? "footage" : "photos", assignee_id: lead?.id || "", due_at: dueIn(1), brief: "" });
  const [f, setF] = useState(blank);
  const [files, setFiles] = useState([]);
  const [pickDate, setPickDate] = useState(false);
  const quick = DUE.find(([, d]) => dueIn(d) === f.due_at);

  if (!crew.length)
    return <p className="rounded-xl bg-panel-2 px-3 py-2.5 text-[12px] text-muted">Add people to the Production group on the Team page to ask them for raw photos or footage.</p>;

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong p-3 text-left transition hover:border-brand hover:bg-brand/[0.04]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
          <Icon name="video" size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Need raw {video ? "footage" : "photos"}?</span>
          <span className="block text-[11.5px] text-muted">Ask Production — {task.assignee?.name.split(" ")[0] || "the assignee"} is told when it&apos;s uploaded</span>
        </span>
        <Icon name="plus" size={14} className="text-faint group-hover:text-brand" />
      </button>
    );

  const submit = (e) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await requestRaw(task.id, f);
      if (!r.ok) return setError(r.error);
      for (const [i, file] of files.entries()) {
        setStatus(`Uploading ${i + 1} of ${files.length}…`);
        const u = await startTaskUpload(r.id, file.name, file.size);
        const up = u.ok ? await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || undefined }) : { error: { message: u.error } };
        if (up.error) {
          setStatus("");
          setError(`Sent, but "${file.name}" didn't upload: ${up.error.message}`);
          router.refresh();
          return;
        }
        await addTaskFile(r.id, { path: u.path, name: file.name, size: file.size, role: "reference" });
      }
      setStatus("");
      setFiles([]);
      setF(blank());
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-panel-2/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-semibold">Ask Production</p>
        <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-panel-2" aria-label="Close">
          <Icon name="x" size={13} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {RAW_WHAT.map(([id, label]) => (
          <Chip key={id} on={f.what === id} onClick={() => setF((v) => ({ ...v, what: id }))}>
            {label}
          </Chip>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-muted">Who shoots it</label>
        <select className="field" value={f.assignee_id} onChange={(e) => setF((v) => ({ ...v, assignee_id: e.target.value }))}>
          {crew.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.lead ? " · Team lead" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-muted">What to shoot</label>
        <textarea
          className="field resize-y"
          rows={4}
          required
          value={f.brief}
          onChange={(e) => setF((v) => ({ ...v, brief: e.target.value }))}
          placeholder={video ? "e.g. 3 product shots in motion, 10–15 sec each, vertical 9:16, natural light…" : "e.g. Front + side shots of the new pack on a white background, 4–5 lifestyle shots…"}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-muted">Needed by</label>
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
          <Chip on={pickDate || !quick} onClick={() => setPickDate(true)}>
            Pick date
          </Chip>
        </div>
        {(pickDate || !quick) && <input type="datetime-local" className="field mt-2" value={f.due_at} onChange={(e) => setF((v) => ({ ...v, due_at: e.target.value }))} />}
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong bg-panel px-3 py-2.5 text-[12.5px] text-muted transition hover:border-brand hover:text-ink">
          <Icon name="paperclip" size={14} />
          {files.length ? `${files.length} reference${files.length > 1 ? "s" : ""} — add more` : "Add references (moodboard, sample shots…)"}
          <input type="file" multiple className="hidden" onChange={(e) => (setFiles((cur) => [...cur, ...(e.target.files ? [...e.target.files] : [])]), (e.target.value = ""))} />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-panel px-3 py-1.5 text-[12px]">
                <Icon name="file" size={12} className="text-muted" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button type="button" aria-label="Remove" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="text-faint hover:text-rose-400">
                  <Icon name="x" size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-[12.5px] text-rose-500">{error}</p>}
      <button disabled={pending || !f.brief.trim()} className="btn-primary btn-sm justify-center">
        {status || (pending ? "Sending…" : `Send to ${crew.find((p) => p.id === f.assignee_id)?.name.split(" ")[0] || "Production"}`)} <Icon name="arrow" size={13} />
      </button>
    </form>
  );
}
