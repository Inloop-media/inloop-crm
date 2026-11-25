"use client";
// The list of requirements (click one to see its story and act on it) + the "New requirement" form.
// The receiver can upload files / assets and submit: they go back to the person who asked.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { addRequirement, changeRequirement, requirementUploadUrl, seenRequirement } from "@/app/(crm)/requirements/actions";
import { createClient } from "@/lib/supabase/browser";

const MAX_FILE = 50 * 1024 * 1024;
const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Files (and links) sent back on a requirement, with open + download. */
function Delivered({ files = [], links = [] }) {
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {files.map((f) => (
        <li key={f.path} className="flex items-center gap-2 rounded-lg bg-panel-2 px-2.5 py-1.5 text-[12.5px]">
          <Icon name="paperclip" size={13} className="shrink-0 text-muted" />
          <a href={f.href || undefined} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
            {f.name}
          </a>
          <span className="shrink-0 text-[10.5px] text-faint">{f.size ? size(f.size) : ""}</span>
          {f.download && (
            <a href={f.download} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted hover:bg-panel hover:text-ink" title="Download">
              <Icon name="download" size={13} />
            </a>
          )}
        </li>
      ))}
      {links.map((l) => (
        <li key={l} className="flex items-center gap-2 rounded-lg bg-panel-2 px-2.5 py-1.5 text-[12.5px]">
          <Icon name="link" size={13} className="shrink-0 text-muted" />
          <a href={l} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
            {l}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Receiver: upload the files / assets (or paste a link) and submit — it goes back to the requester. */
function Submit({ r, note, onDone }) {
  const input = useRef(null);
  const [files, setFiles] = useState([]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const add = (list) => {
    const picked = [...list];
    const big = picked.find((f) => f.size > MAX_FILE);
    if (big) setError(`${big.name} is over 50 MB.`);
    setFiles((cur) => [...cur, ...picked.filter((f) => f.size > 0 && f.size <= MAX_FILE)].slice(0, 20));
  };
  const submit = async () => {
    setError("");
    try {
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusy(`Uploading ${i + 1} of ${files.length}…`);
        const u = await requirementUploadUrl(r.id, f.name, f.size);
        if (!u.ok) throw new Error(u.error);
        const { error: upErr } = await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || undefined });
        if (upErr) throw new Error(upErr.message);
        uploaded.push({ path: u.path, name: f.name, size: f.size, type: f.type });
      }
      setBusy("Submitting…");
      const res = await changeRequirement(r.id, { deliver: { files: uploaded, links: link.trim() ? [link.trim()] : [] }, ...(note.trim() ? { note } : {}) });
      if (!res.ok) throw new Error(res.error);
      setFiles([]);
      setLink("");
      onDone();
    } catch (e) {
      setError(e.message || "Couldn't upload. Try again.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div
      className="rounded-2xl border border-dashed border-line-strong p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        add(e.dataTransfer.files);
      }}
    >
      <div className="mb-2 text-[12.5px] font-medium">Upload &amp; submit</div>
      <p className="mb-2 text-[11.5px] text-muted">Add the files or assets {first(r.from?.name) || "they"} asked for. Submitting marks it done and sends them back.</p>
      {files.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-panel-2 px-2.5 py-1.5 text-[12.5px]">
              <Icon name="paperclip" size={13} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-[10.5px] text-faint">{size(f.size)}</span>
              <button type="button" disabled={!!busy} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="grid h-5 w-5 place-items-center rounded-full text-faint hover:text-rose-400" title="Remove">
                <Icon name="x" size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!!busy} onClick={() => input.current?.click()} className="btn-ghost btn-sm">
          <Icon name="paperclip" size={13} /> Add files
        </button>
        <input className="field min-w-[180px] flex-1 py-1.5 text-[12.5px]" placeholder="…or paste a link (Drive, Figma)" value={link} onChange={(e) => setLink(e.target.value)} disabled={!!busy} />
        <button type="button" disabled={!!busy || (!files.length && !/^https?:\/\//i.test(link.trim()))} onClick={submit} className="btn-primary btn-sm">
          <Icon name="arrow" size={13} /> {busy || `Submit to ${first(r.from?.name) || "them"}`}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

const STATUS = {
  open: { label: "New", color: "#3b82f6" },
  in_progress: { label: "Working on it", color: "#f59e0b" },
  done: { label: "Done", color: "#10b981" },
  rejected: { label: "Can't do", color: "#94a3b8" },
};
const CATEGORIES = [
  ["equipment", "Equipment"],
  ["software", "Software / tool"],
  ["access", "Access / login"],
  ["assets", "Assets / content"],
  ["help", "Help / guidance"],
  ["other", "Other"],
];
const CAT = Object.fromEntries(CATEGORIES);
const PRI = { high: ["High", "#ef4444"], medium: ["Medium", "#f59e0b"], low: ["Low", "#94a3b8"] };
const IST = "Asia/Kolkata";
const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short" });
const dtFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const nowMs = () => Date.now();
function ago(d) {
  const m = Math.round((nowMs() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
const first = (n) => String(n || "").split(" ")[0];

function Pill({ status }) {
  const s = STATUS[status] || STATUS.open;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function NewRequirement({ recipients }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ to_id: recipients[0]?.id || "", title: "", details: "", category: "other", priority: "medium", needed_by: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm">
        <Icon name="plus" size={13} /> New requirement
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <form
            className="pop relative flex max-h-[90svh] w-full max-w-lg flex-col gap-3 overflow-y-auto p-5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await addRequirement(f);
                if (!r.ok) return setError(r.error);
                setOpen(false);
                setF((v) => ({ ...v, title: "", details: "", needed_by: "" }));
                setError("");
                router.push("/requirements?box=sent");
                router.refresh();
              });
            }}
          >
            <div>
              <h2 className="text-[15px] font-medium">New requirement</h2>
              <p className="text-xs text-muted">They get a notification, and you can track it here.</p>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Send to
              <select className="field" value={f.to_id} onChange={set("to_id")}>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              What do you need?
              <input className="field" placeholder="e.g. Adobe After Effects licence" value={f.title} onChange={set("title")} required autoFocus />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Details
              <textarea className="field min-h-[90px]" placeholder="Why you need it, links, anything that helps" value={f.details} onChange={set("details")} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Type
                <select className="field" value={f.category} onChange={set("category")}>
                  {CATEGORIES.map(([id, l]) => (
                    <option key={id} value={id}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Priority
                <select className="field" value={f.priority} onChange={set("priority")}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Needed by
                <input type="date" className="field" value={f.needed_by} onChange={set("needed_by")} />
              </label>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
                Cancel
              </button>
              <button disabled={pending} className="btn-primary btn-sm">
                <Icon name="arrow" size={13} /> {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Detail({ r, meId, staff, recipients, names }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [forward, setForward] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const receiver = r.to_id === meId || staff;
  const requester = r.from_id === meId;
  const open = ["open", "in_progress"].includes(r.status);
  const act = (change) =>
    start(async () => {
      const res = await changeRequirement(r.id, { ...change, ...(note.trim() ? { note } : {}) });
      if (!res.ok) return setError(res.error);
      setNote("");
      setForward("");
      setError("");
      router.refresh();
    });
  const passTo = recipients.filter((x) => x.id !== r.from_id && x.id !== r.to_id);
  const line = (h) => {
    const who = h.by === meId ? "You" : first(names[h.by]);
    if (h.type === "created") return `${who} asked`;
    if (h.type === "status") return `${who} → ${STATUS[h.status]?.label}`;
    if (h.type === "forward") return `${who} passed it to ${first(names[h.to])}`;
    if (h.type === "delivered") return `${who} submitted ${(h.files || []).length ? `${h.files.length} file${h.files.length > 1 ? "s" : ""}` : "a link"} — done`;
    return `${who} wrote`;
  };
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      {r.details && <p className="whitespace-pre-wrap text-[13px] text-ink/85">{r.details}</p>}
      <ol className="flex flex-col gap-1.5">
        {(r.history || []).map((h, i) => (
          <li key={i} className="flex gap-2 text-[12px]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
            <span className="min-w-0 flex-1">
              <span className="text-muted">{line(h)}</span>
              <span className="ml-2 text-[10.5px] text-faint">{dtFmt.format(new Date(h.at))}</span>
              {h.note && <span className="mt-0.5 block whitespace-pre-wrap rounded-lg bg-panel-2 px-2.5 py-1.5 text-[12.5px] text-ink/90">{h.note}</span>}
              {h.type === "delivered" && <Delivered files={h.files} links={h.links} />}
            </span>
          </li>
        ))}
      </ol>
      {receiver && open && (
        <Submit
          r={r}
          note={note}
          onDone={() => {
            setNote("");
            router.refresh();
          }}
        />
      )}
      <textarea className="field min-h-[56px] text-[13px]" placeholder={receiver ? "Add a note (optional) — e.g. ordered, arriving Friday" : "Add a note"} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {receiver && open && r.status === "open" && (
          <button disabled={pending} onClick={() => act({ status: "in_progress" })} className="btn-ghost btn-sm">
            <Icon name="clock" size={13} /> Working on it
          </button>
        )}
        {receiver && open && (
          <button disabled={pending} onClick={() => act({ status: "done" })} className="btn-primary btn-sm">
            <Icon name="check" size={13} /> Mark done
          </button>
        )}
        {receiver && open && !requester && (
          <button disabled={pending} onClick={() => act({ status: "rejected" })} className="btn-ghost btn-sm">
            Can&apos;t do
          </button>
        )}
        {requester && open && !receiver && (
          <button disabled={pending} onClick={() => act({ status: "rejected" })} className="btn-ghost btn-sm">
            Withdraw
          </button>
        )}
        {!open && (receiver || requester) && (
          <button disabled={pending} onClick={() => act({ status: "open" })} className="btn-ghost btn-sm">
            Reopen
          </button>
        )}
        <button disabled={pending || !note.trim()} onClick={() => act({})} className="btn-ghost btn-sm">
          <Icon name="chat" size={13} /> Send note
        </button>
        {receiver && open && passTo.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5">
            <select className="field w-auto py-1.5 text-[12px]" value={forward} onChange={(e) => setForward(e.target.value)}>
              <option value="">Pass it to…</option>
              {passTo.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <button disabled={pending || !forward} onClick={() => act({ forward })} className="btn-ghost btn-sm">
              Pass
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export default function RequirementBoard({ items, meId, staff, recipients, names, openId, box, show }) {
  const router = useRouter();
  const [open, setOpen] = useState(openId || null);
  const [read, setRead] = useState([]); // opened in this tab — their "new" dot goes straight away
  // Opening one marks its replies read, so the sidebar number goes down
  const markRead = (id) => {
    const r = items.find((x) => x.id === id);
    if (!r?.unread || read.includes(id)) return;
    setRead((x) => [...x, id]);
    seenRequirement(id).then(() => router.refresh());
  };
  const toggle = (id) => {
    setOpen(open === id ? null : id);
    if (open !== id) markRead(id);
  };
  // Came here from a notification (?open=…): that one counts as read too
  const fromLink = useRef(openId);
  useEffect(() => {
    const id = fromLink.current;
    fromLink.current = null;
    if (id && items.some((x) => x.id === id && x.unread)) seenRequirement(id).then(() => router.refresh());
  }, [items, router]);
  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...items].sort((a, b) => (show === "open" ? order[a.priority] - order[b.priority] : 0) || b.created_at.localeCompare(a.created_at));
  if (!sorted.length)
    return (
      <div className="card px-6 py-12 text-center text-sm text-muted">
        {show === "closed" ? "Nothing closed yet." : box === "inbox" ? "Nothing waiting on you ✓" : "You haven't asked for anything. Use New requirement when you need something."}
      </div>
    );
  return (
    <ul className="rise flex flex-col gap-2">
      {sorted.map((r) => {
        const [pl, pc] = PRI[r.priority] || PRI.medium;
        const other = box === "sent" ? r.to : r.from;
        const late = r.needed_by && ["open", "in_progress"].includes(r.status) && r.needed_by < new Date(nowMs()).toLocaleDateString("en-CA", { timeZone: IST });
        const isOpen = open === r.id;
        return (
          <li key={r.id} className={`card p-4 transition ${isOpen ? "ring-1 ring-brand/40" : ""}`}>
            <button type="button" onClick={() => toggle(r.id)} className="flex w-full items-center gap-3 text-left">
              <Avatar name={other?.name || "?"} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: pc }} title={`${pl} priority`} />
                  <span className="truncate text-[14px] font-medium">{r.title}</span>
                  {r.unread && !read.includes(r.id) && !(openId === r.id) && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">New</span>}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-muted">
                  {box === "all" ? `${first(r.from?.name)} → ${first(r.to?.name)}` : box === "sent" ? `To ${r.to?.name}` : `From ${r.from?.name}`} · {CAT[r.category] || "Other"} · {ago(r.created_at)}
                  {r.needed_by && <span className={late ? "font-medium text-rose-400" : ""}> · needed by {dateFmt.format(new Date(`${r.needed_by}T00:00:00+05:30`))}</span>}
                </span>
              </span>
              {(r.history || []).some((h) => h.type === "delivered") && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-400" title="Files sent back">
                  <Icon name="paperclip" size={11} /> {(r.history || []).filter((h) => h.type === "delivered").reduce((n, h) => n + (h.files || []).length + (h.links || []).length, 0)}
                </span>
              )}
              <Pill status={r.status} />
              <Icon name="chevron" size={14} className={`shrink-0 text-faint transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && <Detail r={r} meId={meId} staff={staff} recipients={recipients} names={names} />}
          </li>
        );
      })}
    </ul>
  );
}
