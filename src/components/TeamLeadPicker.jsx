"use client";
// On a group's page: the head picks who leads the group day to day (e.g. the senior designer).
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { setTeamLead } from "@/app/(crm)/actions";

export default function TeamLeadPicker({ groupId, members, current }) {
  const [value, setValue] = useState(current || "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand/12 text-brand">
        <Icon name="team" size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">Team lead</div>
        <div className="text-[11px] text-muted">The group can message their team lead and you directly.</div>
      </div>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          const before = value;
          setValue(v);
          start(async () => {
            const r = await setTeamLead(groupId, v || null);
            if (!r.ok) {
              setValue(before);
              setError(r.error);
            } else setError("");
          });
        }}
        className="field w-auto min-w-[180px] py-1.5"
      >
        <option value="">No team lead</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error && <p className="w-full text-xs text-rose-400">{error}</p>}
    </div>
  );
}
