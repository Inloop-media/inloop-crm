"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { submitFeedback } from "@/app/(crm)/actions";

const KINDS = [
  { id: "problem", label: "Problem", icon: "alert", hint: "What's not working? Where did it happen?" },
  { id: "idea", label: "Idea", icon: "sparkle", hint: "What would make your work easier?" },
  { id: "general", label: "Other", icon: "chat", hint: "Tell us anything about the CRM…" },
];

/** Feedback for anyone except admins: a button in the corner that opens a small card. */
export default function FeedbackNote() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("problem");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const current = KINDS.find((k) => k.id === kind);

  const send = () =>
    start(async () => {
      setError("");
      const res = await submitFeedback({ kind, message, page: path });
      if (!res.ok) return setError(res.error || "Couldn't send that.");
      setSent(true);
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2400);
    });

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-4 z-40 md:bottom-8 md:right-8">
      {open ? (
        <div className="rise card w-[min(22rem,calc(100vw-2rem))] origin-bottom-right overflow-hidden p-2 shadow-[var(--pop-shadow)]" role="dialog" aria-label="Send feedback">
          {/* Header band */}
          <div className="tint-lavender flex items-start gap-3 rounded-[22px] p-4">
            <span className="icon-tile">
              <Icon name="chat" size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-medium leading-tight">Share feedback</div>
              <p className="mt-1 text-xs text-ink/60">Problems, ideas, anything about the CRM.</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/60 text-ink/60 transition hover:bg-white hover:text-ink dark:bg-white/10 dark:hover:bg-white/20">
              <Icon name="x" size={14} />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="tint-green grid h-14 w-14 place-items-center rounded-full text-emerald-400">
                <Icon name="check" size={22} />
              </span>
              <div className="text-base font-medium">Thanks — it&apos;s with the admins</div>
              <p className="text-xs text-muted">They&apos;ll read it and get back to you if needed.</p>
            </div>
          ) : (
            <div className="p-3 pt-4">
              <div className="label">What is it about?</div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kind">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    role="radio"
                    aria-checked={kind === k.id}
                    onClick={() => setKind(k.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-medium transition duration-200 ${
                      kind === k.id ? "solid" : "bg-panel-2 text-muted hover:-translate-y-0.5 hover:text-ink"
                    }`}
                  >
                    <Icon name={k.icon} size={16} />
                    {k.label}
                  </button>
                ))}
              </div>

              <div className="relative mt-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder={current.hint}
                  className="field resize-none pb-7"
                />
                <span className="pointer-events-none absolute bottom-2.5 right-3.5 text-[10px] tabular-nums text-faint">{message.length}/4000</span>
              </div>
              {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

              <div className="mt-3 flex items-center gap-3">
                <span className="flex flex-1 items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  Only admins see this
                </span>
                <button onClick={send} disabled={pending || message.trim().length < 3} className="btn-primary">
                  {pending ? "Sending…" : "Send"}
                  {!pending && <Icon name="arrow" size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          className="solid group flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium transition duration-300 hover:-translate-y-1"
        >
          <Icon name="chat" size={18} />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}
    </div>
  );
}
