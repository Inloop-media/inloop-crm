"use client";
// Review a task right from the list: send it to the client, approve it, or send it back with a note.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { reviewTask } from "@/app/(crm)/tasks/actions";

export default function ReviewButtons({ task }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [note, setNote] = useState(null); // null = closed
  const clientAsked = task.status === "client_rejected";
  const go = (action, feedback) =>
    start(async () => {
      setError("");
      const res = await reviewTask(task.id, action, { feedback });
      if (!res.ok) return setError(res.error);
      setNote(null);
      router.refresh();
    });

  if (note !== null)
    return (
      <form
        className="flex w-full flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go(clientAsked ? "reassign" : "send_back", note);
        }}
      >
        <textarea autoFocus rows={2} className="field resize-y text-sm" placeholder={`What should ${task.assignee?.name.split(" ")[0] || "they"} change?`} value={note} onChange={(e) => setNote(e.target.value)} required={!clientAsked} />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary btn-sm">
            {pending ? "Sending…" : "Send back"}
          </button>
          <button type="button" onClick={() => setNote(null)} className="btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      </form>
    );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {clientAsked ? (
          <button disabled={pending} onClick={() => setNote(task.feedback || "")} className="btn-primary btn-sm">
            <Icon name="refresh" size={13} /> Send to {task.assignee?.name.split(" ")[0] || "team"} to fix
          </button>
        ) : (
          <>
            <button disabled={pending} onClick={() => go("share_client")} className="btn-primary btn-sm">
              <Icon name="arrow" size={13} /> Send to client
            </button>
            <button disabled={pending} onClick={() => go("approve")} className="btn-ghost btn-sm">
              <Icon name="check" size={13} /> Approve
            </button>
            <button disabled={pending} onClick={() => setNote("")} className="btn-ghost btn-sm">
              <Icon name="back" size={13} /> Send back
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
