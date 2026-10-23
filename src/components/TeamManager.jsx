"use client";

import { useActionState, useState, useTransition } from "react";
import { addMember, updateMember } from "@/app/(crm)/actions";
import { ROLES } from "@/lib/constants";

function MemberRow({ m, isMe }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const change = (patch) =>
    start(async () => {
      const res = await updateMember(m.id, patch);
      setError(res.ok ? "" : res.error);
    });

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${m.active ? "" : "opacity-50"}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {m.name} {isMe && <span className="text-xs text-muted">(you)</span>}
        </div>
        <div className="truncate text-xs text-muted">{m.email}</div>
        {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
      </div>
      <select value={m.role} disabled={pending || isMe} onChange={(e) => change({ role: e.target.value })} className="field w-auto">
        {ROLES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {!isMe && (
        <button disabled={pending} onClick={() => change({ active: !m.active })} className="btn-ghost">
          {m.active ? "Remove access" : "Restore"}
        </button>
      )}
    </li>
  );
}

export default function TeamManager({ members, meId }) {
  const [state, action, pending] = useActionState(addMember, {});
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="grid gap-3 rounded-xl border border-line bg-panel p-5 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="field" placeholder="Aryan Verma" />
        </div>
        <div>
          <label className="label" htmlFor="email">Google account email</label>
          <input id="email" name="email" type="email" required className="field" placeholder="name@inloopmedia.com" />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue="executive" className="field">
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button disabled={pending} className="btn-primary">{pending ? "Adding…" : "Add"}</button>
        {(state?.error || state?.message) && (
          <p className={`text-sm sm:col-span-4 ${state.error ? "text-red-400" : "text-emerald-400"}`}>{state.error || state.message}</p>
        )}
      </form>

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
        {members.map((m) => (
          <MemberRow key={m.id} m={m} isMe={m.id === meId} />
        ))}
      </ul>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.id} className="rounded-xl border border-line p-4">
            <dt className="font-medium">{r.label}</dt>
            <dd className="mt-1 text-muted">{r.help}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
