"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

// WhatsApp-style chat between a brand and the Inloop team.
// Live: Supabase Realtime broadcast on `chat-{brandId}` ("msg", "read", "typing"); a slow poll is the
// safety net. Server actions (already bound to the brand) do the reading and writing:
//   load() → { ok, messages, reads }   send(body, files) → { ok }   upload(name, size) → { ok, path, token }
//   markRead() → { ok }

const IST = "Asia/Kolkata";
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IST });
const dayKey = (d) => keyFmt.format(new Date(d));
function dayLabel(d) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const k = dayKey(d);
  if (k === dayKey(today)) return "Today";
  if (k === dayKey(yesterday)) return "Yesterday";
  return dayFmt.format(new Date(d));
}
const isImg = (a) => /^image\//.test(a.type || "") || /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(a.name || "");
const isVid = (a) => /^video\//.test(a.type || "") || /\.(mp4|mov|webm|m4v)$/i.test(a.name || "");
const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ext = (name) => (String(name).split(".").pop() || "file").slice(0, 4).toUpperCase();
const POLL_MS = 30000;
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]|www\.[^\s<]+[^\s<.,:;"')\]!?])/g;

export function Linkified({ text }) {
  return String(text)
    .split(URL_RE)
    .map((part, i) =>
      i % 2 ? (
        <a key={i} href={part.startsWith("http") ? part : `https://${part}`} target="_blank" rel="noreferrer" className="break-all underline decoration-current/40 underline-offset-2 hover:decoration-current">
          {part}
        </a>
      ) : (
        part
      )
    );
}

function Ticks({ state }) {
  if (state === "sending")
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60" aria-label="Sending">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  const read = state === "read";
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="none" stroke={read ? "#34b7f1" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={read ? "" : "opacity-55"} aria-label={read ? "Read" : "Delivered"}>
      <path d="M1 6l3 3 6-7" />
      <path d="M7 9l1 0.5L15 2" />
    </svg>
  );
}

export function Attachments({ files, onOpen }) {
  const imgs = files.filter((a) => isImg(a) && (a.href || a.preview));
  const rest = files.filter((a) => !imgs.includes(a));
  return (
    <div className="flex flex-col gap-1">
      {imgs.length > 0 && (
        <div className={`grid gap-1 ${imgs.length > 1 ? "grid-cols-2" : ""}`}>
          {imgs.slice(0, 4).map((a, i) => (
            <button key={a.path || a.preview} type="button" onClick={() => onOpen(a)} className="relative block overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
              <img src={a.href || a.preview} alt={a.name} loading="lazy" className={`w-full object-cover ${imgs.length > 1 ? "aspect-square" : "max-h-80"}`} />
              {i === 3 && imgs.length > 4 && <span className="absolute inset-0 grid place-items-center bg-black/55 text-2xl font-medium text-white">+{imgs.length - 4}</span>}
            </button>
          ))}
        </div>
      )}
      {rest.map((a) =>
        isVid(a) && a.href ? (
          <video key={a.path} src={a.href} controls playsInline preload="metadata" className="max-h-80 w-full rounded-xl bg-black" />
        ) : (
          <a key={a.path || a.name} href={a.href || undefined} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-black/[0.06] px-3 py-2.5 dark:bg-white/[0.06]">
            <span className={`grid h-10 w-9 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white ${/pdf$/i.test(a.name) ? "bg-rose-500" : "bg-brand"}`}>{ext(a.name)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{a.name}</span>
              <span className="text-[11px] opacity-60">{a.size ? fmtSize(a.size) : ""}</span>
            </span>
          </a>
        )
      )}
    </div>
  );
}

export default function BrandChat({ brandId, brandName, side, meId, meName, initial, lastReadAt, load, send, upload, markRead, className = "h-[600px]", subtitle, members = [] }) {
  const [showMembers, setShowMembers] = useState(false);
  const roleOf = Object.fromEntries(members.map((m) => [m.id, m.role]));
  const [messages, setMessages] = useState(initial?.messages || []);
  const [reads, setReads] = useState(initial?.reads || {});
  const [pending, setPending] = useState([]); // optimistic messages
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // { file, preview, name, size, type }
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [typing, setTyping] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef(null);
  const unreadLine = useRef(null);
  const input = useRef(null);
  const fileInput = useRef(null);
  const channel = useRef(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef(null);
  const lastMarked = useRef(null);
  const following = useRef(true); // the user is at the bottom → keep following new messages
  const draftKey = `inloop-chat-draft:${brandId}:${side}`;

  const fromOthers = useCallback((m) => (side === "client" ? !m.from_client : m.from_client || m.member?.id !== meId), [side, meId]);
  const fromMySide = (m) => (side === "client" ? m.from_client : !m.from_client);

  // Where the user left off: the first message from the others they haven't read
  const firstUnreadId = useMemo(() => {
    const m = (initial?.messages || []).find((x) => fromOthers(x) && (!lastReadAt || x.created_at > lastReadAt));
    return m?.id || null;
  }, [initial, lastReadAt, fromOthers]);
  const unreadCount = useMemo(() => {
    if (!firstUnreadId) return 0;
    const i = (initial?.messages || []).findIndex((x) => x.id === firstUnreadId);
    return (initial?.messages || []).slice(i).filter(fromOthers).length;
  }, [initial, firstUnreadId, fromOthers]);

  const refresh = useCallback(async () => {
    const r = await load().catch(() => null);
    if (r?.ok) {
      setMessages(r.messages);
      setReads(r.reads || {});
    }
  }, [load]);

  // Restore the draft (after hydration — the server has no localStorage)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const d = localStorage.getItem(draftKey);
        if (d) setText((cur) => cur || d);
      } catch {}
    });
    return () => clearTimeout(t);
  }, [draftKey]);
  useEffect(() => {
    try {
      if (text) localStorage.setItem(draftKey, text);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [text, draftKey]);

  // Open at the unread line, else at the bottom
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (unreadLine.current) el.scrollTop = Math.max(0, unreadLine.current.offsetTop - 80);
    else el.scrollTop = el.scrollHeight;
  }, []); // first paint only

  // New messages: follow them if the user is at the bottom
  const total = messages.length + pending.length;
  useEffect(() => {
    const el = scroller.current;
    if (el && following.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [total]); // only when the count changes

  // Live updates
  useEffect(() => {
    const sb = createClient();
    const ch = sb.channel(`chat-${brandId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "msg" }, () => refresh())
      .on("broadcast", { event: "read" }, ({ payload }) => payload?.at && setReads((r) => ({ ...r, [payload.side]: payload.at > (r[payload.side] || "") ? payload.at : r[payload.side] })))
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload?.name) return;
        setTyping(payload.name);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(""), 3500);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh(); // catch up on anything sent while connecting
      });
    channel.current = ch;
    const poll = setInterval(() => !document.hidden && refresh(), POLL_MS);
    const onVisible = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      clearTimeout(typingTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(ch);
      channel.current = null;
    };
  }, [brandId, refresh]);

  // Mark read when something new from the others is on screen
  const newestOther = useMemo(() => [...messages].reverse().find(fromOthers)?.created_at || null, [messages, fromOthers]);
  useEffect(() => {
    if (!newestOther || newestOther === lastMarked.current) return;
    const mark = () => {
      if (document.hidden) return;
      lastMarked.current = newestOther;
      markRead().catch(() => {});
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [newestOther, markRead]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAtBottom(following.current);
  };

  const sayTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current < 2000 || !channel.current) return;
    lastTyping.current = now;
    channel.current.send({ type: "broadcast", event: "typing", payload: { name: side === "client" ? brandName : meName || "Inloop" } });
  };

  const addFiles = (list) => {
    const picked = [...(list || [])].filter((f) => f.size > 0);
    const big = picked.find((f) => f.size > 50 * 1024 * 1024);
    if (big) setError(`${big.name} is over 50 MB.`);
    const ok = picked.filter((f) => f.size <= 50 * 1024 * 1024);
    setFiles((cur) => [...cur, ...ok.map((file) => ({ file, name: file.name || "pasted-image.png", size: file.size, type: file.type, preview: /^image\//.test(file.type) ? URL.createObjectURL(file) : "" }))].slice(0, 10));
    input.current?.focus();
  };
  const removeFile = (i) =>
    setFiles((cur) => {
      if (cur[i]?.preview) URL.revokeObjectURL(cur[i].preview);
      return cur.filter((_, j) => j !== i);
    });

  const submit = async () => {
    const body = text.trim();
    if ((!body && !files.length) || busy) return;
    const tempId = `tmp-${Date.now()}`;
    const outgoing = files;
    setPending((p) => [...p, { id: tempId, body, from_client: side === "client", member: side === "team" ? { id: meId, name: meName } : null, created_at: new Date().toISOString(), attachments: outgoing.map((f) => ({ name: f.name, size: f.size, type: f.type, preview: f.preview })), sending: true }]);
    setText("");
    setFiles([]);
    setError("");
    following.current = true;
    setAtBottom(true);
    setBusy(outgoing.length ? "Uploading…" : "Sending…");
    try {
      const sent = [];
      for (const [i, f] of outgoing.entries()) {
        if (outgoing.length > 1) setBusy(`Uploading ${i + 1} of ${outgoing.length}…`);
        const u = await upload(f.name, f.size);
        if (!u.ok) throw new Error(u.error);
        const { error: upErr } = await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, f.file, { contentType: f.type || undefined });
        if (upErr) throw new Error(upErr.message);
        sent.push({ path: u.path, name: f.name, size: f.size, type: f.type });
      }
      const r = await send(body, sent);
      if (!r.ok) throw new Error(r.error);
      await refresh();
      outgoing.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    } catch (e) {
      setError(e.message || "Couldn't send. Try again.");
      setText(body);
      setFiles(outgoing);
    } finally {
      setPending((p) => p.filter((m) => m.id !== tempId));
      setBusy("");
    }
  };

  const all = [...messages, ...pending];
  const tickState = (m) => {
    if (m.sending) return "sending";
    const other = side === "client" ? reads.team : reads.client;
    return other && other >= m.created_at ? "read" : "sent";
  };
  const who = (m) => (m.from_client ? brandName : m.member?.name || "Inloop team");

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-[22px] border border-line bg-panel ${className}`}
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types || [])].includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer?.files);
      }}
    >
      {/* Header: a WhatsApp-style group — the brand and everyone on the Inloop side */}
      <button type="button" onClick={() => setShowMembers((v) => !v)} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-panel-2/60">
        <span className="relative shrink-0">
          <Avatar name={brandName} size={40} />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-[9px] font-bold text-white ring-2 ring-panel">in</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{brandName} × Inloop</div>
          <div className={`truncate text-xs ${typing ? "font-medium text-emerald-500" : "text-muted"}`}>
            {typing
              ? `${typing} is typing…`
              : members.length
                ? `${[side === "client" ? "You" : brandName, ...members.map((m) => (m.id === meId ? "You" : m.name.split(" ")[0]))].join(", ")}`
                : subtitle || (side === "client" ? "Your account team" : "Client chat · they see this on their dashboard")}
          </div>
        </div>
        {members.length > 0 && (
          <span className="hidden shrink-0 -space-x-2 sm:flex">
            {members.slice(0, 4).map((m) => (
              <Avatar key={m.id} name={m.name} size={26} />
            ))}
          </span>
        )}
        <Icon name="chevron" size={14} className={`shrink-0 text-faint transition ${showMembers ? "rotate-180" : ""}`} />
      </button>
      {showMembers && (
        <div className="border-b border-line bg-panel-2/40 px-4 py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Group · {members.length + 1} members</div>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-3">
              <Avatar name={brandName} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {brandName}
                {side === "client" && <span className="text-muted"> (you)</span>}
              </span>
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">Client</span>
            </li>
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} size={30} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {m.name}
                  {m.id === meId && <span className="text-muted"> (you)</span>}
                </span>
                <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-medium text-brand">{m.role}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Everyone here sees every message, and gets a notification when something new comes in.</p>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="chat-wall min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {all.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-2xl bg-panel/90 p-5 text-center text-sm text-muted shadow-sm">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-panel-2">
              <Icon name="chat" size={18} />
            </div>
            {side === "client" ? "Say hi! Questions, ideas, references — send them to the Inloop team here." : `No messages with ${brandName} yet. Say hello 👋`}
          </div>
        )}
        <div className="flex flex-col">
          {all.map((m, i) => {
            const prev = all[i - 1];
            const own = side === "client" ? m.from_client : !m.from_client && m.member?.id === meId;
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const sameRun = !newDay && prev && prev.from_client === m.from_client && prev.member?.id === m.member?.id && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000;
            const showName = !own && !sameRun && (side === "team" || !m.from_client);
            const hasFiles = (m.attachments || []).length > 0;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-lg bg-panel/95 px-3 py-1 text-[11px] font-medium text-muted shadow-sm">{dayLabel(m.created_at)}</span>
                  </div>
                )}
                {m.id === firstUnreadId && (
                  <div ref={unreadLine} className="my-3 flex justify-center">
                    <span className="rounded-lg bg-brand/15 px-3 py-1 text-[11px] font-semibold text-brand">
                      {unreadCount} unread message{unreadCount === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
                <div className={`flex ${own ? "justify-end" : "justify-start"} ${sameRun ? "mt-0.5" : "mt-2"}`}>
                  <div
                    className={`relative max-w-[85%] rounded-2xl px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-snug shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] sm:max-w-[70%] ${
                      own ? `chat-own ${sameRun ? "" : "rounded-tr-[4px]"}` : `bg-panel ${sameRun ? "" : "rounded-tl-[4px]"}`
                    } ${hasFiles ? "min-w-[220px]" : ""}`}
                  >
                    {showName && (
                      <div className="flex items-baseline gap-1.5 px-1 pb-0.5">
                        <span className="text-[12.5px] font-semibold" style={{ color: m.from_client ? "#f59e0b" : "var(--color-brand)" }}>{who(m)}</span>
                        <span className="text-[10px] text-muted">{m.from_client ? "Client" : roleOf[m.member?.id] || "Inloop"}</span>
                      </div>
                    )}
                    {hasFiles && <Attachments files={m.attachments} onOpen={setLightbox} />}
                    {m.body ? (
                      <div className={`whitespace-pre-wrap break-words px-1 ${hasFiles ? "pt-1.5" : ""}`}>
                        <Linkified text={m.body} />
                        <span className="inline-block w-[62px]" />
                      </div>
                    ) : (
                      <div className="h-4" />
                    )}
                    <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[10.5px] opacity-60">
                      {timeFmt.format(new Date(m.created_at))}
                      {fromMySide(m) && <Ticks state={tickState(m)} />}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })}
          className="absolute bottom-24 right-4 grid h-10 w-10 place-items-center rounded-full bg-panel text-muted shadow-lg ring-1 ring-line hover:text-ink"
          aria-label="Jump to the latest"
        >
          <Icon name="chevron" size={16} />
        </button>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-brand/10 backdrop-blur-[2px]">
          <div className="rounded-2xl bg-panel px-5 py-4 text-sm font-medium shadow-lg">Drop to attach</div>
        </div>
      )}

      {/* Files waiting to be sent */}
      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-line bg-panel-2 px-3 py-3">
          {files.map((f, i) => (
            <div key={i} className="relative shrink-0">
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview
                <img src={f.preview} alt={f.name} className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <div className="flex h-20 w-32 flex-col justify-between rounded-xl bg-panel p-2.5">
                  <span className="text-[10px] font-bold text-brand">{ext(f.name)}</span>
                  <span className="line-clamp-2 text-[11px] leading-tight">{f.name}</span>
                </div>
              )}
              <button type="button" onClick={() => removeFile(i)} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-panel shadow" aria-label={`Remove ${f.name}`}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-line bg-panel px-3 py-2.5">
        <input ref={fileInput} type="file" multiple className="hidden" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
        <button type="button" onClick={() => fileInput.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-ink" aria-label="Attach photo, video or file" title="Photo, video, PDF…">
          <Icon name="plus" size={20} />
        </button>
        <textarea
          ref={input}
          rows={1}
          className="max-h-36 min-h-[44px] flex-1 resize-none rounded-[22px] bg-panel-2 px-4 py-[11px] text-[15px] leading-snug outline-none placeholder:text-faint focus:ring-2 focus:ring-brand/30"
          placeholder={files.length ? "Add a caption…" : "Type a message"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            sayTyping();
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 144)}px`;
          }}
          onPaste={(e) => {
            const pasted = [...(e.clipboardData?.files || [])];
            if (pasted.length) {
              e.preventDefault();
              addFiles(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={Boolean(busy) || (!text.trim() && !files.length)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-sm transition hover:bg-brand-strong disabled:opacity-40"
          aria-label="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </div>
      {(busy || error) && (
        <div className={`px-4 pb-2 text-[11px] ${error ? "text-rose-400" : "text-muted"}`}>{error || busy}</div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/90" onClick={() => setLightbox(null)}>
          <div className="flex items-center gap-3 p-4 text-white">
            <span className="min-w-0 flex-1 truncate text-sm">{lightbox.name}</span>
            {lightbox.href && (
              <a href={lightbox.href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-full px-3 py-1.5 text-sm hover:bg-white/10">
                Open original
              </a>
            )}
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={lightbox.href || lightbox.preview} alt={lightbox.name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}
