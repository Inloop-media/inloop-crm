"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { clientDecide } from "./actions";

/** Approve / Request changes on one piece of work. */
export default function Decide({ taskId }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const send = (decision) =>
    start(async () => {
      setError("");
      const r = await clientDecide(taskId, decision, note);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2.5">
      {mode === "changes" ? (
        <>
          <textarea className="field resize-y" rows={3} autoFocus placeholder="What should we change?" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setMode(null)} className="btn-ghost btn-sm">
              Back
            </button>
            <button onClick={() => send("changes")} disabled={pending || note.trim().length < 3} className="btn-primary btn-sm ml-auto">
              {pending ? "Sending…" : "Send to the team"}
            </button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode("changes")} disabled={pending} className="btn-ghost justify-center">
            <Icon name="refresh" size={14} /> Request changes
          </button>
          <button onClick={() => send("approve")} disabled={pending} className="btn-primary justify-center">
            <Icon name="check" size={14} /> {pending ? "Approving…" : "Approve"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
