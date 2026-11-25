"use client";
// Announcements page: the composer (admin / CBOs) and the feed everyone sees. Posters see who has seen each one.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { announcementUploadUrl, deleteAnnouncement, postAnnouncement } from "@/app/(crm)/announcements/actions";

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const isImg = (f) => /^image\//.test(f?.type || "") || /\.(jpe?g|png|webp|gif|avif)$/i.test(f?.name || "");

/** Text with its links clickable. */
export function Linkified({ text, className = "" }) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </p>
  );
}

/** The attachment and the link of an announcement. */
export function Extras({ a, light = false }) {
  if (!a.file && !a.link) return null;
  const chip = light ? "bg-white/15 text-white hover:bg-white/25" : "bg-panel-2 text-ink hover:bg-line";
  return (
    <div className="mt-3 flex flex-col gap-2">
      {a.file && isImg(a.file) && (
        <a href={a.file.href} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
          <img src={a.file.href} alt={a.file.name} className="max-h-[360px] w-full object-cover" />
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        {a.file && !isImg(a.file) && (
          <a href={a.file.href} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${chip}`}>
            <Icon name="paperclip" size={12} /> {a.file.name}
          </a>
        )}
        {a.link && (
          <a href={a.link} target="_blank" rel="noreferrer" className={`flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${chip}`}>
            <Icon name="external" size={12} /> <span className="truncate">{a.link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function Composer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState(false);
  const [, start] = useTransition();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim() && !body.trim()) return setError("Write the announcement first.");
    let attached = null;
    if (file) {
      setBusy("Uploading…");
      const u = await announcementUploadUrl(file.name, file.size);
      if (!u.ok) return (setBusy(""), setError(u.error));
      const { error: up } = await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, file, { contentType: file.type || undefined });
      if (up) return (setBusy(""), setError(up.message));
      attached = { path: u.path, name: file.name, type: file.type };
    }
    setBusy("Sending…");
    const r = await postAnnouncement({ title, body, link, file: attached });
    setBusy("");
    if (!r.ok) return setError(r.error);
    setTitle("");
    setBody("");
    setLink("");
    setFile(null);
    setDone(true);
    setTimeout(() => setDone(false), 4000);
    start(() => router.refresh());
  };

  return (
    <form onSubmit={submit} className="card-coral rise flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-normal tracking-[-0.01em]">Announce to everyone</h2>
          <p className="mt-0.5 text-[12px] text-white/80">Goes to every team member&apos;s phone and pops up in their CRM until they press “Got it”.</p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
          <Icon name="speaker" size={18} />
        </span>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Headline (e.g. Office closed on Friday)" className="w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-[14px] font-medium text-[#18181b] placeholder:text-[#71717a] focus:outline-none focus:ring-2 focus:ring-white/60" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} placeholder="Write the message…" className="w-full resize-y rounded-xl border-0 bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#18181b] placeholder:text-[#71717a] focus:outline-none focus:ring-2 focus:ring-white/60" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={link} onChange={(e) => setLink(e.target.value)} type="url" placeholder="Link (optional) — https://…" className="min-w-0 flex-1 rounded-xl border-0 bg-white/95 px-3.5 py-2 text-[13px] text-[#18181b] placeholder:text-[#71717a] focus:outline-none focus:ring-2 focus:ring-white/60" />
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-[12.5px] font-medium transition hover:bg-white/25">
          <Icon name="paperclip" size={13} />
          <span className="max-w-[180px] truncate">{file ? file.name : "Attach photo / PDF"}</span>
          <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => (setFile(e.target.files?.[0] || null), (e.target.value = ""))} />
        </label>
        {file && (
          <button type="button" onClick={() => setFile(null)} className="rounded-xl px-2 text-[12px] text-white/80 hover:text-white" aria-label="Remove the attachment">
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
      {error && <p className="rounded-xl bg-white px-3 py-2 text-[12.5px] text-rose-600">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {done && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-white">
            <Icon name="check" size={13} /> Sent to everyone
          </span>
        )}
        <button disabled={!!busy || (!title.trim() && !body.trim())} className="flex items-center gap-2 rounded-full bg-[#18181b] px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-black disabled:opacity-50">
          <Icon name="speaker" size={14} /> {busy || "Send to everyone"}
        </button>
      </div>
    </form>
  );
}

function Seen({ a, team }) {
  const [open, setOpen] = useState(false);
  const audience = team.filter((m) => m.id !== a.author?.id && new Date(m.created_at).getTime() <= new Date(a.created_at).getTime() + 864e5 * 30);
  const seen = audience.filter((m) => a.seenBy.includes(m.id));
  const notYet = audience.filter((m) => !a.seenBy.includes(m.id));
  const pct = audience.length ? Math.round((seen.length / audience.length) * 100) : 0;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left text-[12px] text-muted hover:text-ink">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-panel-2">
          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </span>
        <span>
          Seen by <b className="font-medium tabular-nums text-ink">{seen.length}</b> of {audience.length}
        </span>
        <Icon name="chevron" size={12} className={`ml-auto transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2">
          <div>
            <p className="mb-1.5 font-medium text-muted">Not seen yet · {notYet.length}</p>
            <p className="leading-relaxed">{notYet.map((m) => m.name).join(", ") || "Everyone has seen it 🎉"}</p>
          </div>
          <div>
            <p className="mb-1.5 font-medium text-muted">Seen · {seen.length}</p>
            <p className="leading-relaxed text-muted">{seen.map((m) => m.name).join(", ") || "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Announcements({ items, team, me, canPost, missing }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const remove = (id) =>
    confirm("Delete this announcement for everyone?") &&
    start(async () => {
      const r = await deleteAnnouncement(id);
      if (!r.ok) alert(r.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {missing && <p className="card p-4 text-sm text-muted">Announcements aren&apos;t set up yet — run migration 030_announcements.sql in Supabase.</p>}
      {canPost && !missing && <Composer />}
      {items.length ? (
        items.map((a, i) => (
          <article key={a.id} className={`rise card p-5 ${i === 0 ? "ring-1 ring-brand/30" : ""}`}>
            <header className="flex items-center gap-3">
              <Avatar name={a.author?.name || "Inloop"} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{a.author?.name || "Inloop"}</div>
                <div className="text-[11.5px] text-muted">{when.format(new Date(a.created_at))}</div>
              </div>
              {i === 0 && <span className="rounded-full bg-brand/12 px-2.5 py-1 text-[10.5px] font-semibold text-brand">Latest</span>}
              {(a.author?.id === me.id || me.role === "admin") && (
                <button type="button" disabled={pending} onClick={() => remove(a.id)} className="icon-btn h-8 w-8 hover:text-rose-400" aria-label="Delete announcement" title="Delete">
                  <Icon name="trash" size={13} />
                </button>
              )}
            </header>
            {a.title && <h2 className="mt-4 text-[20px] font-normal leading-snug tracking-[-0.01em]">{a.title}</h2>}
            {a.body && <Linkified text={a.body} className={`${a.title ? "mt-1.5" : "mt-4"} text-[14px] leading-relaxed text-ink/90`} />}
            <Extras a={a} />
            {canPost && <Seen a={a} team={team} />}
          </article>
        ))
      ) : !missing ? (
        <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center text-sm text-muted">
          <Icon name="speaker" size={20} />
          No announcements yet.{canPost ? " Write one above — it goes to everyone." : ""}
        </div>
      ) : null}
    </div>
  );
}
