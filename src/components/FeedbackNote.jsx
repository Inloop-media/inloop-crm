"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { submitFeedback } from "@/app/(crm)/actions";

const MOODS = [
  { v: 1, e: "😣", label: "Frustrated" },
  { v: 2, e: "😕", label: "Not great" },
  { v: 3, e: "😐", label: "Okay" },
  { v: 4, e: "🙂", label: "Good" },
  { v: 5, e: "😍", label: "Love it" },
];
const KINDS = [
  { id: "problem", label: "Problem" },
  { id: "idea", label: "Idea" },
  { id: "general", label: "Just saying" },
];

/** A sticky note pinned to the corner: anyone (except admins) can tell the admins how the CRM is going. */
export default function FeedbackNote() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState(null);
  const [kind, setKind] = useState("problem");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError("");
      const res = await submitFeedback({ mood, kind, message, page: path });
      if (!res.ok) return setError(res.error || "Couldn't send that.");
      setSent(true);
      setMessage("");
      setMood(null);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2200);
    });

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] right-4 z-40 md:bottom-8 md:right-8">
      {open ? (
        <div className="rise relative w-[min(20rem,calc(100vw-2rem))] origin-bottom-right rotate-[0.6deg]">
          {/* tape */}
          <span className="absolute -top-3 left-1/2 z-10 h-6 w-20 -translate-x-1/2 -rotate-2 rounded-sm bg-white/50 shadow-sm backdrop-blur-sm dark:bg-white/15" />
          <div className="note rounded-[22px] p-5 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-medium leading-tight">How&apos;s the CRM going?</div>
                <p className="mt-1 text-xs text-ink/60">Problems, ideas, anything. Only the admins see it.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/50 text-ink/60 transition hover:bg-white hover:text-ink dark:bg-white/10">
                <Icon name="x" size={14} />
              </button>
            </div>

            {sent ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="solid grid h-12 w-12 place-items-center rounded-full">
                  <Icon name="check" size={20} />
                </span>
                <div className="font-medium">Thank you!</div>
                <p className="text-xs text-ink/60">The admins will read it.</p>
              </div>
            ) : (
              <>
                <div className="mt-4 flex justify-between" role="radiogroup" aria-label="How do you feel">
                  {MOODS.map((m) => (
                    <button
                      key={m.v}
                      role="radio"
                      aria-checked={mood === m.v}
                      title={m.label}
                      onClick={() => setMood(mood === m.v ? null : m.v)}
                      className={`grid h-11 w-11 place-items-center rounded-2xl text-[22px] transition duration-200 ${
                        mood === m.v ? "scale-110 bg-white shadow-md dark:bg-white/20" : mood ? "opacity-40 grayscale hover:opacity-80" : "hover:scale-110 hover:bg-white/50 dark:hover:bg-white/10"
                      }`}
                    >
                      {m.e}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => setKind(k.id)}
                      className={`rounded-full px-3 py-1.5 text-xs transition ${kind === k.id ? "solid" : "bg-white/50 text-ink/70 hover:bg-white/80 dark:bg-white/10"}`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder={kind === "problem" ? "What's not working? Where did it happen?" : kind === "idea" ? "What would make your work easier?" : "Tell us anything…"}
                  className="mt-3 w-full resize-none rounded-2xl border border-white/60 bg-white/60 px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:bg-white focus:ring-4 focus:ring-black/5 dark:border-white/10 dark:bg-black/20 dark:focus:bg-black/30"
                />
                {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
                <button onClick={send} disabled={pending || message.trim().length < 3} className="btn-primary mt-3 w-full">
                  {pending ? "Sending…" : "Send to admins"}
                  {!pending && <Icon name="arrow" size={14} />}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          className="note group flex -rotate-3 items-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition duration-300 hover:-translate-y-1 hover:rotate-0"
        >
          <Icon name="chat" size={17} />
          <span className="hidden sm:inline">Feedback</span>
        </button>
      )}
    </div>
  );
}
