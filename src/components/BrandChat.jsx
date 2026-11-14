"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const POLL_MS = 8000;

/**
 * The brand's conversation between the client and the team.
 *   side: "client" (the brand's dashboard) or "team" (the brand page in the CRM)
 *   load(): { ok, messages }   send(body): { ok, error? }   — server actions, already bound to the brand
 */
export default function BrandChat({ initial = [], side, meId, brandName, load, send, height = "h-[520px]" }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const list = useRef(null);
  const count = messages.length;

  // Keep the newest message in view
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  // New messages from the other side: poll while the tab is open
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      const r = await load().catch(() => null);
      if (alive && r?.ok) setMessages(r.messages);
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const submit = () => {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      setError("");
      const r = await send(body);
      if (!r.ok) return setError(r.error);
      setText("");
      const fresh = await load();
      if (fresh?.ok) setMessages(fresh.messages);
    });
  };

  const mine = (m) => (side === "client" ? m.from_client : !m.from_client && m.member?.id === meId);
  const who = (m) => (m.from_client ? brandName : m.member?.name || "Inloop team");

  return (
    <div className="flex flex-col">
      <div ref={list} className={`${height} flex flex-col gap-3 overflow-y-auto pr-1`}>
        {count === 0 && (
          <div className="m-auto max-w-xs text-center text-sm text-muted">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-panel-2">
              <Icon name="chat" size={18} />
            </div>
            {side === "client" ? "Questions, ideas, feedback — write to the Inloop team here." : `No messages with ${brandName} yet.`}
          </div>
        )}
        {messages.map((m) => {
          const own = mine(m);
          return (
            <div key={m.id} className={`flex items-end gap-2 ${own ? "flex-row-reverse" : ""}`}>
              {!own && <Avatar name={who(m)} size={26} />}
              <div className={`max-w-[80%] ${own ? "items-end" : "items-start"} flex flex-col`}>
                {!own && <span className="mb-1 px-1 text-[11px] text-muted">{who(m)}</span>}
                <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${own ? "solid rounded-br-md" : "bg-panel-2 rounded-bl-md"}`}>{m.body}</div>
                <span className="mt-1 px-1 text-[10px] text-faint">{timeFmt.format(new Date(m.created_at))}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <textarea
          className="field min-h-[44px] flex-1 resize-none"
          rows={1}
          placeholder="Write a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button onClick={submit} disabled={pending || !text.trim()} className="btn-primary h-11 shrink-0" aria-label="Send">
          <Icon name="arrow" size={15} />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
