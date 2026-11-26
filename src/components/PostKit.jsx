"use client";
// The posting kit for one content-calendar post — on the calendar's post panel and on the posting task.
// The final files of the approved version (photos, video, carousel slides in order), the caption to copy,
// where and when it goes out, and "Mark as posted" (with the post's link). Once posted it says who and when.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { getPostingKit, markPosted, unmarkPosted } from "@/app/(crm)/tasks/actions";

const isImg = (n) => /\.(jpe?g|png|webp|gif|heic)$/i.test(n || "");
const isVid = (n) => /\.(mp4|mov|webm|m4v)$/i.test(n || "");
const day = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function FileTile({ f, n }) {
  return (
    <li className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="relative bg-panel-2">
        {n && <span className="absolute left-2 top-2 z-[1] grid h-6 min-w-6 place-items-center rounded-full bg-black/65 px-1.5 text-[11px] font-semibold text-white">{n}</span>}
        {f.drive && (isImg(f.name) || isVid(f.name)) ? (
          // Google Drive file: Google's own preview picture (opens to play / view in Drive)
          <a href={f.href} target="_blank" rel="noreferrer" className="relative block">
            {/* eslint-disable-next-line @next/next/no-img-element -- Drive thumbnail */}
            <img src={f.thumb} alt={f.name} className="aspect-[4/5] w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            {isVid(f.name) && <span className="absolute inset-0 grid place-items-center text-[28px] text-white drop-shadow">▶</span>}
          </a>
        ) : !f.drive && !f.link && isImg(f.name) && f.href ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={f.href} alt={f.name} className="aspect-[4/5] w-full object-cover" loading="lazy" />
        ) : !f.drive && !f.link && isVid(f.name) && f.href ? (
          <video src={f.href} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain" />
        ) : (
          <span className="grid aspect-[4/3] place-items-center text-muted">
            <Icon name={f.link ? "link" : "file"} size={20} />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2 text-[12px]">
        <span className="min-w-0 flex-1 truncate">{f.link ? (/drive\.google|docs\.google/.test(f.href) ? "Google Drive" : f.name) : f.name}</span>
        <a href={f.link ? f.href : f.download} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 font-medium text-brand hover:underline">
          {f.link ? (
            <>
              Open <Icon name="external" size={11} />
            </>
          ) : (
            <>
              <Icon name="download" size={12} /> Save
            </>
          )}
        </a>
      </div>
    </li>
  );
}

/** `itemId` — the calendar post. `compact` hides the header (the post panel already shows the title). */
export default function PostKit({ itemId, compact = false }) {
  const router = useRouter();
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const load = () => getPostingKit(itemId).then(setState);
  useEffect(() => {
    let live = true;
    getPostingKit(itemId).then((r) => live && setState(r));
    return () => {
      live = false;
    };
  }, [itemId]);

  if (!state) return <div className="skeleton h-40 w-full rounded-2xl" />;
  if (!state.ok) return <p className="text-[12.5px] text-muted">{state.error}</p>;
  const { kit, canPost, canUndo } = state;
  const { item, files, approved } = kit;
  const posted = item.status === "posted";
  const saved = files.filter((f) => !f.link);
  const carousel = item.kind === "carousel" && saved.length > 1;
  const caption = item.caption || item.caption_direction;

  const run = (fn) =>
    start(async () => {
      setError("");
      const r = await fn();
      if (!r.ok) return setError(r.error);
      await load();
      router.refresh();
    });
  const downloadAll = async () => {
    for (const f of saved) {
      const a = document.createElement("a");
      a.href = f.download;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 600));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold">Post kit</h3>
          <span className="text-[12.5px] text-muted">
            {item.platforms.join(", ") || "Instagram"} · {day.format(new Date(`${item.publish_on}T00:00:00Z`))}
          </span>
        </div>
      )}

      {posted ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300">
          <Icon name="check" size={15} />
          <span className="flex-1">
            Posted{item.posted_by ? ` by ${item.posted_by}` : ""}
            {item.posted_at ? ` · ${when.format(new Date(item.posted_at))}` : ""}
          </span>
          {item.post_url && (
            <a href={item.post_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium hover:underline">
              View post <Icon name="external" size={12} />
            </a>
          )}
          {canUndo && !undoOpen && (
            <button type="button" disabled={pending} onClick={() => setUndoOpen(true)} className="text-[12px] text-muted hover:text-ink">
              Undo
            </button>
          )}
        </div>
      ) : null}

      {posted && undoOpen && (
        <form
          className="flex flex-col gap-2 rounded-2xl border border-line p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await unmarkPosted(itemId, reason);
              if (r.ok) {
                setUndoOpen(false);
                setReason("");
              }
              return r;
            });
          }}
        >
          <label className="text-[12.5px] font-medium" htmlFor={`undo-${itemId}`}>
            Why undo it? <span className="font-normal text-muted">— it goes back to the Social Media team with this note</span>
          </label>
          <textarea id={`undo-${itemId}`} className="field min-h-[70px]" placeholder="e.g. Wrong caption went out — delete it and post the corrected one" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} autoFocus />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => (setUndoOpen(false), setReason(""), setError(""))} className="btn-ghost btn-sm">
              Cancel
            </button>
            <button disabled={pending || reason.trim().length < 3} className="btn-primary btn-sm">
              {pending ? "Saving…" : "Undo and send back"}
            </button>
          </div>
        </form>
      )}

      {posted ? null : kit.undo ? (
        <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-700 dark:text-amber-300">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>
            <b className="font-medium">Post it again</b>
            {kit.undo.by ? ` — ${kit.undo.by.split(" ")[0]} undid it` : ""}
            {kit.undo.at ? ` on ${when.format(new Date(kit.undo.at))}` : ""}
            {kit.undo.reason ? <span className="mt-0.5 block text-ink">“{kit.undo.reason}”</span> : null}
          </span>
        </div>
      ) : !approved ? (
        <p className="flex items-start gap-2 rounded-2xl bg-panel-2 px-4 py-3 text-[12.5px] text-muted">
          <Icon name="clock" size={14} className="mt-0.5 shrink-0" />
          Not approved by the client yet — it comes to the Social Media team to post as soon as it is.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-2xl bg-sky-500/10 px-4 py-3 text-[12.5px] text-sky-700 dark:text-sky-300">
          <Icon name="check" size={14} className="mt-0.5 shrink-0" />
          Approved by the client — ready to post{kit.posting?.assignee ? ` · with ${kit.posting.assignee.name.split(" ")[0]}` : ""}.
        </p>
      )}

      {/* Final files */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[12px] font-medium text-muted">
            Final {carousel ? `carousel · ${saved.length} slides` : files.length === 1 ? "file" : "files"}
            {kit.maker ? ` · by ${kit.maker.split(" ")[0]}` : ""}
          </span>
          {saved.length > 1 && (
            <button type="button" onClick={downloadAll} className="flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
              <Icon name="download" size={12} /> Download all
            </button>
          )}
        </div>
        {kit.folders?.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {kit.folders.map((d) => (
              <a key={d.href} href={d.href} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                <Icon name="board" size={12} /> {d.name} · Open in Drive <Icon name="external" size={11} />
              </a>
            ))}
          </div>
        )}
        {files.length ? (
          <ul className={`grid gap-2 ${files.some((f) => isVid(f.name)) ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
            {files.map((f, i) => (
              <FileTile key={f.id} f={f} n={carousel && !f.link ? i + 1 : null} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-[12px] text-faint">No final files yet — they show up here once the work is uploaded.</p>
        )}
      </div>

      {/* Caption */}
      {(caption || item.cta) && (
        <div className="rounded-2xl border border-line p-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">{item.caption ? "Caption" : "Caption direction"}</span>
            {caption && (
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(caption).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
                className="flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
              >
                <Icon name={copied ? "check" : "file"} size={12} /> {copied ? "Copied" : "Copy caption"}
              </button>
            )}
          </div>
          {caption && <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{caption}</p>}
          {item.cta && <p className="mt-2 text-[12px] text-muted">CTA: {item.cta}</p>}
        </div>
      )}

      {/* Mark as posted */}
      {!posted && approved && canPost && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="field flex-1" type="url" inputMode="url" placeholder="Link of the live post — https://instagram.com/p/…" aria-label="Link of the live post (required)" value={link} onChange={(e) => setLink(e.target.value)} />
          <button type="button" disabled={pending || !/^https?:\/\/\S+\.\S+$/i.test(link.trim())} title={link.trim() ? "" : "Paste the post's link first"} onClick={() => run(() => markPosted(itemId, link.trim()))} className="btn-primary justify-center">
            <Icon name="check" size={14} /> {pending ? "Saving…" : "Mark as posted"}
          </button>
        </div>
      )}
      {error && <p className="text-[12.5px] text-rose-500">{error}</p>}
    </div>
  );
}
