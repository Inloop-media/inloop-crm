"use client";
// One tap: move my task to In progress.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { setTaskStatus } from "@/app/(crm)/tasks/actions";

export default function StartTask({ id, label = "Start" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <button
      title={error || undefined}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setTaskStatus(id, "in_progress");
          if (!res.ok) setError(res.error);
          router.refresh();
        })
      }
      className={`btn-ghost btn-sm ${error ? "!border-rose-400 text-rose-400" : ""}`}
    >
      <Icon name="arrow" size={13} /> {pending ? "Starting…" : label}
    </button>
  );
}
