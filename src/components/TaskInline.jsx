"use client";
// Small in-place editors for the task table: change who does it or when it's due without opening it.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui";
import { updateTask } from "@/app/(crm)/tasks/actions";

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const save = (patch) =>
    start(async () => {
      setError("");
      const res = await updateTask(patch.id, patch.changes);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  return { pending, error, save };
}

export function InlinePerson({ task, people }) {
  const { pending, error, save } = useSave();
  const [value, setValue] = useState(task.assignee?.id || "");
  const name = people.find((p) => p.id === value)?.name || task.assignee?.name;
  return (
    <label title={error || "Change who does it"} className={`relative flex min-w-0 cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2 text-xs transition hover:bg-panel ${pending ? "opacity-50" : ""} ${error ? "ring-1 ring-rose-400" : ""}`}>
      {name ? <Avatar name={name} size={22} /> : null}
      <span className="truncate">{name || "Unassigned"}</span>
      <select
        aria-label="Assignee"
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          save({ id: task.id, changes: { assignee_id: e.target.value } });
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {!value && <option value="">Unassigned</option>}
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.open} open
          </option>
        ))}
      </select>
    </label>
  );
}

/** Shows the due label; click to pick a new date (kept at 7 pm India time). */
export function InlineDue({ task, children }) {
  const { pending, error, save } = useSave();
  const day = task.due_at ? new Date(new Date(task.due_at).getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : "";
  return (
    <label title={error || "Change the due date"} className={`relative inline-flex cursor-pointer items-center rounded-full px-2 py-1 transition hover:bg-panel ${pending ? "opacity-50" : ""} ${error ? "ring-1 ring-rose-400" : ""}`}>
      {children}
      <input
        type="date"
        aria-label="Due date"
        defaultValue={day}
        disabled={pending}
        onChange={(e) => e.target.value && save({ id: task.id, changes: { due_at: e.target.value } })}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
