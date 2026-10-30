"use client";

import { useTransition } from "react";
import { setFeedbackStatus } from "@/app/(crm)/actions";

/** Admin buttons under a feedback note: seen / done / reopen. */
export default function FeedbackStatus({ id, status }) {
  const [pending, start] = useTransition();
  const set = (s) => start(() => setFeedbackStatus(id, s));
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-xs">
      {status === "new" && (
        <button onClick={() => set("seen")} disabled={pending} className="btn-ghost px-3.5 py-1.5 text-xs">
          Mark seen
        </button>
      )}
      {status !== "done" ? (
        <button onClick={() => set("done")} disabled={pending} className="btn-primary px-3.5 py-1.5 text-xs">
          Done
        </button>
      ) : (
        <button onClick={() => set("new")} disabled={pending} className="btn-ghost px-3.5 py-1.5 text-xs">
          Reopen
        </button>
      )}
    </div>
  );
}
