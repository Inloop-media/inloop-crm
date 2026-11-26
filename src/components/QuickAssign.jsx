"use client";
// "New task" from anywhere: what, which brand, who, by when. Press N to open it.
// Every field has a label; the due date and priority are one tap; the brief is tucked away until needed.
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import FileDrop from "@/components/FileDrop";
import DrivePicker from "@/components/DrivePicker";
import { setTaskFolders } from "@/app/(crm)/drive/actions";
import { PersonSelect } from "@/components/TaskForms";
import { addTaskFile, createTask, listProductionCrew, requestRaw, startTaskUpload } from "@/app/(crm)/tasks/actions";
import { createClient } from "@/lib/supabase/browser";
import { RAW_WHAT, TASK_KINDS } from "@/lib/constants";

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
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]); // Drive folders the work goes into: [{ drive_id, path, note }]
  const [uploading, setUploading] = useState("");
  // Needs raw photos / footage from Production first (a linked "shoot" task for e.g. Aryan)
  const [raw, setRaw] = useState(null); // null = off
  const [crew, setCrew] = useState(null);
  const isVideo = ["reel", "video"].includes(f.kind);
  const toggleRaw = () => {
    if (raw) return setRaw(null);
    setRaw({ what: isVideo ? "footage" : "photos", assignee_id: "", brief: "", due_at: dueIn(0) });
    if (!crew)
      listProductionCrew().then((list) => {
        setCrew(list);
        setRaw((r) => (r && !r.assignee_id ? { ...r, assignee_id: (list.find((p) => p.lead) || list[0])?.id || "" } : r));
      });
  };
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
    if (raw && !raw.assignee_id) return setError("Pick who in Production shoots it.");
    if (raw && !raw.brief.trim()) return setError("Write what Production should shoot.");
    start(async () => {
      setError("");
      const res = await createTask(f.brand, f);
      if (!res.ok) return setError(res.error);
      if (folders.length) {
        const fr = await setTaskFolders(res.id, folders);
        if (!fr.ok) setError(`Task given, but the Drive folders didn't save: ${fr.error} — add them from the task.`);
      }
      if (raw) {
        setUploading("Asking Production…");
        const r = await requestRaw(res.id, raw);
        if (!r.ok) {
          setUploading("");
          setError(`Task given, but the Production request didn't go: ${r.error} — ask from the task page.`);
          router.refresh();
          return;
        }
      }
      // Optional files for the person doing it (references, copy, raw footage…)
      for (const [i, file] of files.entries()) {
        setUploading(`Uploading ${i + 1} of ${files.length}…`);
        const u = await startTaskUpload(res.id, file.name, file.size);
        const up = u.ok ? await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || undefined }) : { error: { message: u.error } };
        if (up.error) {
          setUploading("");
          setError(`Task given, but "${file.name}" didn't upload: ${up.error.message} — add it from the task page.`);
          router.refresh();
          return;
        }
        await addTaskFile(res.id, { path: u.path, name: file.name, size: file.size, role: "reference" });
      }
      setUploading("");
      setFiles([]);
      setFolders([]);
      setRaw(null);
      setDone(`“${f.title}” given to ${who?.name.split(" ")[0] || "them"}.`);
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
                    <select id="qa-brand" className="field" value={f.brand} onChange={(e) => (setFolders([]), set("brand")(e))}>
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

                {f.brand && (
                  <div>
                    <Label>Google Drive folders — where they upload the work</Label>
                    <DrivePicker key={f.brand} brandId={f.brand} value={folders} onChange={setFolders} />
                  </div>
                )}

                <div>
                  <FileDrop onFiles={(picked) => setFiles((cur) => [...cur, ...picked])} label="Drop to attach to this task" hint="References, copy, raw footage — up to 50 MB each" />
                  <Label>Files (optional)</Label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-3 text-[13px] text-muted transition hover:border-brand hover:text-ink">
                    <Icon name="paperclip" size={15} />
                    {files.length ? `${files.length} file${files.length > 1 ? "s" : ""} attached — add more` : "Drag files here or click — references, copy, raw footage (up to 50 MB each)"}
                    <input type="file" multiple className="hidden" onChange={(e) => {
                      // Copy the files now: clearing the input empties its list before React runs the update
                      const picked = [...(e.target.files || [])];
                      e.target.value = "";
                      setFiles((cur) => [...cur, ...picked]);
                    }} />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {files.map((file, i) => (
                        <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-panel-2 px-3 py-1.5 text-[12.5px]">
                          <Icon name="file" size={13} className="text-muted" />
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                          <span className="text-faint">{file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`}</span>
                          <button type="button" aria-label="Remove" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="text-faint hover:text-rose-400">
                            <Icon name="x" size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={`rounded-2xl border transition ${raw ? "border-brand/40 bg-brand/[0.03]" : "border-line"}`}>
                  <button type="button" onClick={toggleRaw} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${raw ? "bg-brand text-white" : "bg-brand/10 text-brand"}`}>
                      <Icon name="video" size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">Needs raw {isVideo ? "footage" : "photos"} from Production</span>
                      <span className="block text-[11.5px] text-muted">They shoot it first; {who ? who.name.split(" ")[0] : "the person doing it"} is notified when it&apos;s uploaded</span>
                    </span>
                    <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${raw ? "bg-brand" : "bg-panel-3"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${raw ? "left-[18px]" : "left-0.5"}`} />
                    </span>
                  </button>
                  {raw && (
                    <div className="flex flex-col gap-3.5 border-t border-line px-4 pb-4 pt-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {RAW_WHAT.map(([id, l]) => (
                          <Chip key={id} on={raw.what === id} onClick={() => setRaw((r) => ({ ...r, what: id }))}>
                            {l}
                          </Chip>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Who shoots it</Label>
                          {crew === null ? (
                            <div className="field text-muted">Loading…</div>
                          ) : crew.length ? (
                            <select className="field" value={raw.assignee_id} onChange={(e) => setRaw((r) => ({ ...r, assignee_id: e.target.value }))}>
                              {crew.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.lead ? " · Team lead" : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-[12px] text-muted">No one in the Production group yet — add them on the Team page.</p>
                          )}
                        </div>
                        <div>
                          <Label>Raw needed by</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {DUE.slice(0, 3).map(([l, d]) => (
                              <Chip key={l} on={raw.due_at === dueIn(d)} onClick={() => setRaw((r) => ({ ...r, due_at: dueIn(d) }))}>
                                {l}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="qa-raw">What to shoot</Label>
                        <textarea
                          id="qa-raw"
                          className="field resize-y"
                          rows={3}
                          value={raw.brief}
                          onChange={(e) => setRaw((r) => ({ ...r, brief: e.target.value }))}
                          placeholder={raw.what === "footage" ? "e.g. 3 product clips in motion, 10–15 sec each, vertical 9:16…" : "e.g. Front + side shots of the new pack on white, 4–5 lifestyle shots…"}
                        />
                      </div>
                    </div>
                  )}
                </div>

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
                  {uploading || (pending ? "Assigning…" : who ? `Assign to ${who.name.split(" ")[0]}` : "Assign")} <Icon name="arrow" size={13} />
                </button>
              </footer>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
