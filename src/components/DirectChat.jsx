"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { Attachments, Linkified } from "@/components/BrandChat";
import { createClient } from "@/lib/supabase/browser";
import { addLeadFromDm, dmUploadUrl, loadDm, markDmRead, sendDm } from "@/app/(crm)/dm/actions";

// A one-to-one chat with a teammate (your head, your team, other heads). Text, files, and "lead cards":
// a sales executive shares a lead, the sales head adds it to the CRM in one click.
// Live: Realtime broadcast on `dm-{myId}` ("msg", "read"); a slow poll is the safety net.

const IST = "Asia/Kolkata";
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: IST });
const dayKey = (d) => keyFmt.format(new Date(d));
function dayLabel(d) {
  const today = new Date();
  const k = dayKey(d);
  if (k === dayKey(today)) return "Today";
  if (k === dayKey(new Date(today.getTime() - 864e5))) return "Yesterday";
  return dayFmt.format(new Date(d));
}
const POLL_MS = 30000;
const MAX = 50 * 1024 * 1024;

function Ticks({ m }) {
  if (m.sending) return <span className="opacity-60">…</span>;
  const read = Boolean(m.read_at);
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="none" stroke={read ? "#34b7f1" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={read ? "" : "opacity-55"} aria-label={read ? "Seen" : "Sent"}>
      <path d="M1 6l3 3 6-7" />
      <path d="M7 9l1 0.5L15 2" />
    </svg>
  );
}

function LeadCard({ m, mine, other, canAddLeads, onAdd, adding }) {
  const l = m.meta || {};
  const rows = [
    ["Contact", l.name],
    ["Phone", l.phone],
    ["Email", l.email],
    ["Service", l.service],
  ].filter(([, v]) => v);
  return (
    <div className="w-[280px] max-w-full overflow-hidden rounded-xl border border-line bg-panel-2/70">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Icon name="leads" size={14} />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">New lead</div>
          <div className="truncate text-[14px] font-semibold">{l.brand || l.name}</div>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-[12.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {l.details && <p className="whitespace-pre-wrap border-t border-line px-3 py-2 text-[12.5px] text-ink/80">{l.details}</p>}
      <div className="border-t border-line px-3 py-2">
        {l.lead_id ? (
          <Link href={`/leads/${l.lead_id}`} className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-400 hover:underline">
            <Icon name="check" size={13} /> Added as {l.lead_code || "a lead"}
          </Link>
        ) : !mine && canAddLeads ? (
          <button type="button" onClick={onAdd} disabled={adding} className="btn-primary btn-sm w-full justify-center">
            <Icon name="plus" size={13} /> {adding ? "Adding…" : "Add as lead"}
          </button>
        ) : (
          <span className="text-[12px] text-muted">{mine ? `Waiting for ${other.name.split(" ")[0]} to add it` : "Not added yet"}</span>
        )}
      </div>
    </div>
  );
}

function ShareLead({ onClose, onSend }) {
  const [f, setF] = useState({ brand: "", name: "", phone: "", email: "", service: "", details: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <form
        className="pop relative flex w-full max-w-md flex-col gap-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const r = await onSend(f);
          setBusy(false);
          if (!r.ok) return setError(r.error);
          onClose();
        }}
      >
        <div>
          <h2 className="text-[15px] font-medium">Share a lead</h2>
          <p className="text-xs text-muted">Your head gets a notification and adds it to the CRM. It comes back to you as your lead.</p>
        </div>
        <input className="field" placeholder="Brand / company" value={f.brand} onChange={set("brand")} autoFocus />
        <input className="field" placeholder="Contact person's name" value={f.name} onChange={set("name")} />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" placeholder="Phone" inputMode="tel" value={f.phone} onChange={set("phone")} />
          <input className="field" placeholder="Email" type="email" value={f.email} onChange={set("email")} />
        </div>
        <input className="field" placeholder="What do they need? (e.g. Social media, Website)" value={f.service} onChange={set("service")} />
        <textarea className="field min-h-[80px]" placeholder="Notes: where you met them, budget, when to call…" value={f.details} onChange={set("details")} />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            Cancel
          </button>
          <button disabled={busy} className="btn-primary btn-sm">
            <Icon name="arrow" size={13} /> {busy ? "Sharing…" : "Share lead"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function DirectChat({ meId, other, initial, canAddLeads, canShareLead, live = true }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial || []);
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(null);
  const scroller = useRef(null);
  const input = useRef(null);
  const fileInput = useRef(null);

  const refresh = useCallback(async () => {
    const r = await loadDm(other.id).catch(() => null);
    if (r?.ok) setMessages(r.messages);
  }, [other.id]);

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, []);
  const total = messages.length + pending.length;
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [total]);

  // Live updates on my channel
  useEffect(() => {
    if (!live) return;
    const sb = createClient();
    const ch = sb.channel(`dm-${meId}`);
    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      if (payload?.from === other.id || payload?.from === meId) refresh();
      router.refresh(); // the list of conversations / unread counts
    })
      .on("broadcast", { event: "read" }, ({ payload }) => payload?.by === other.id && refresh())
      .subscribe((s) => s === "SUBSCRIBED" && refresh());
    const poll = setInterval(() => !document.hidden && refresh(), POLL_MS);
    return () => {
      clearInterval(poll);
      sb.removeChannel(ch);
    };
  }, [meId, other.id, refresh, router, live]);

  // Mark their messages read while the chat is open
  const unseen = messages.some((m) => m.from_id === other.id && !m.read_at);
  useEffect(() => {
    if (!live || !unseen || document.hidden) return;
    markDmRead(other.id).then(() => router.refresh()).catch(() => {});
  }, [unseen, other.id, router, live]);

  const addFiles = (list) => {
    const picked = [...(list || [])].filter((f) => f.size > 0);
    const big = picked.find((f) => f.size > MAX);
    if (big) setError(`${big.name} is over 50 MB.`);
    setFiles((cur) => [...cur, ...picked.filter((f) => f.size <= MAX).map((file) => ({ file, name: file.name || "pasted-image.png", size: file.size, type: file.type, preview: /^image\//.test(file.type) ? URL.createObjectURL(file) : "" }))].slice(0, 10));
    input.current?.focus();
  };

  const submit = async () => {
    const body = text.trim();
    if ((!body && !files.length) || busy) return;
    const tempId = `tmp-${Date.now()}`;
    const outgoing = files;
    setPending((p) => [...p, { id: tempId, from_id: meId, body, kind: "text", created_at: new Date().toISOString(), attachments: outgoing.map((f) => ({ name: f.name, size: f.size, type: f.type, preview: f.preview })), sending: true }]);
    setText("");
    setFiles([]);
    setError("");
    setBusy(outgoing.length ? "Uploading…" : "Sending…");
    try {
      const sent = [];
      for (const f of outgoing) {
        const u = await dmUploadUrl(other.id, f.name, f.size);
        if (!u.ok) throw new Error(u.error);
        const { error: upErr } = await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, f.file, { contentType: f.type || undefined });
        if (upErr) throw new Error(upErr.message);
        sent.push({ path: u.path, name: f.name, size: f.size, type: f.type });
      }
      const r = await sendDm(other.id, body, sent);
      if (!r.ok) throw new Error(r.error);
      await refresh();
    } catch (e) {
      setError(e.message || "Couldn't send. Try again.");
      setText(body);
      setFiles(outgoing);
    } finally {
      setPending((p) => p.filter((m) => m.id !== tempId));
      setBusy("");
    }
  };

  const shareLead = async (lead) => {
    const r = await sendDm(other.id, "", [], lead);
    if (r.ok) await refresh();
    return r;
  };
  const addLead = async (m) => {
    setAdding(m.id);
    setError("");
    const r = await addLeadFromDm(m.id);
    setAdding(null);
    if (!r.ok) return setError(r.error);
    await refresh();
  };

  const all = [...messages, ...pending];
  const first = other.name.split(" ")[0];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/dm" className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-panel-2 md:hidden" aria-label="Back to messages">
          <Icon name="chevron" size={16} className="rotate-90" />
        </Link>
        <Avatar name={other.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium">{other.name}</div>
          <div className="truncate text-xs text-muted">{other.label}</div>
        </div>
        {canShareLead && (
          <button type="button" onClick={() => setSharing(true)} className="btn-ghost btn-sm shrink-0">
            <Icon name="leads" size={13} /> Share a lead
          </button>
        )}
      </header>

      <div ref={scroller} className="chat-wall min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {all.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-2xl bg-panel/90 p-5 text-center text-sm text-muted shadow-sm">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-panel-2">
              <Icon name="chat" size={18} />
            </div>
            Say hi to {first} 👋{canShareLead ? " Got a lead? Use Share a lead." : ""}
          </div>
        )}
        <div className="flex flex-col">
          {all.map((m, i) => {
            const prev = all[i - 1];
            const own = m.from_id === meId;
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const sameRun = !newDay && prev && prev.from_id === m.from_id && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000;
            const hasFiles = (m.attachments || []).length > 0;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-lg bg-panel/95 px-3 py-1 text-[11px] font-medium text-muted shadow-sm">{dayLabel(m.created_at)}</span>
                  </div>
                )}
                <div className={`flex ${own ? "justify-end" : "justify-start"} ${sameRun ? "mt-0.5" : "mt-2"}`}>
                  {m.kind === "lead" ? (
                    <div className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"}`}>
                      <LeadCard m={m} mine={own} other={other} canAddLeads={canAddLeads} onAdd={() => addLead(m)} adding={adding === m.id} />
                      <span className="flex items-center gap-1 px-1 text-[10.5px] text-muted">
                        {timeFmt.format(new Date(m.created_at))}
                        {own && <Ticks m={m} />}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`relative max-w-[85%] rounded-2xl px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-snug shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] sm:max-w-[70%] ${
                        own ? `chat-own ${sameRun ? "" : "rounded-tr-[4px]"}` : `bg-panel ${sameRun ? "" : "rounded-tl-[4px]"}`
                      } ${hasFiles ? "min-w-[220px]" : ""}`}
                    >
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
                        {own && <Ticks m={m} />}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-line bg-panel-2 px-3 py-3">
          {files.map((f, i) => (
            <div key={i} className="relative shrink-0">
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview
                <img src={f.preview} alt={f.name} className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <div className="flex h-20 w-32 flex-col justify-end rounded-xl bg-panel p-2.5">
                  <span className="line-clamp-2 text-[11px] leading-tight">{f.name}</span>
                </div>
              )}
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-panel shadow" aria-label={`Remove ${f.name}`}>
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-line px-3 py-2.5">
        <input ref={fileInput} type="file" multiple className="hidden" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip" onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
        <button type="button" onClick={() => fileInput.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-ink" aria-label="Attach a file">
          <Icon name="plus" size={20} />
        </button>
        <textarea
          ref={input}
          rows={1}
          className="max-h-36 min-h-[44px] flex-1 resize-none rounded-[22px] bg-panel-2 px-4 py-[11px] text-[15px] leading-snug outline-none placeholder:text-faint focus:ring-2 focus:ring-brand/30"
          placeholder={`Message ${first}`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
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
        <button type="button" onClick={submit} disabled={Boolean(busy) || (!text.trim() && !files.length)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-sm transition hover:bg-brand-strong disabled:opacity-40" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </div>
      {(busy || error) && <div className={`px-4 pb-2 text-[11px] ${error ? "text-rose-400" : "text-muted"}`}>{error || busy}</div>}

      {sharing && <ShareLead onClose={() => setSharing(false)} onSend={shareLead} />}
      {lightbox && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
          <img src={lightbox.href || lightbox.preview} alt={lightbox.name} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
