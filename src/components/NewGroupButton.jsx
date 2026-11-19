"use client";
// A CBO makes a new group under themselves (from the Groups page), then lands on it to add people.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { createGroup } from "@/app/(crm)/actions";
import { GROUP_KINDS } from "@/lib/constants";

export default function NewGroupButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createGroup, {});
  const router = useRouter();
  useEffect(() => {
    if (state?.id) router.push(`/groups/${state.id}`);
  }, [state?.id, router]);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm">
        <Icon name="plus" size={13} /> New group
      </button>
    );
  return (
    <form action={action} className="card flex w-full flex-wrap items-end gap-3 p-4">
      <label className="min-w-[180px] flex-1">
        <span className="label">Group name</span>
        <input name="name" required autoFocus placeholder="e.g. SEO" className="field" />
      </label>
      <label className="min-w-[180px] flex-1">
        <span className="label">Works like</span>
        <select name="kind" defaultValue="other" className="field">
          {GROUP_KINDS.filter((k) => k.id !== "execution").map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <button disabled={pending} className="btn-primary">{pending ? "Making…" : "Make group"}</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
      {state?.error && <p className="w-full text-xs text-rose-400">{state.error}</p>}
      <p className="w-full text-[11px] text-faint">It comes under you. Until you give it a manager, you manage it.</p>
    </form>
  );
}
