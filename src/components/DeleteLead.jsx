"use client";
// Admin only: delete a lead for good. Asks once more before it goes.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { deleteLead } from "@/app/(crm)/actions";

export default function DeleteLead({ leadId, label }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const remove = () =>
    start(async () => {
      setError("");
      const r = await deleteLead(leadId);
      if (!r.ok) return setError(r.error);
      router.replace("/leads");
      router.refresh();
    });

  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className="btn-ghost w-full text-rose-400 hover:text-rose-300">
        <Icon name="trash" size={14} /> Delete lead
      </button>
    );

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
      <p className="text-[13px] font-medium">Delete {label} for good?</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">Its notes, history, meetings and proposal files go too. This can&apos;t be undone.</p>
      {error && <p className="mt-2 text-[12px] text-rose-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={pending} onClick={() => (setAsking(false), setError(""))} className="btn-ghost btn-sm flex-1">
          Keep it
        </button>
        <button type="button" disabled={pending} onClick={remove} className="btn-sm flex flex-1 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 font-medium text-white transition hover:bg-rose-500 disabled:opacity-50">
          <Icon name="trash" size={13} /> {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
