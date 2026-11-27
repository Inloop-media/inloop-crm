"use client";
// Search the tasks page as you type: task name, brand or person. The page filters on the server (?q=).
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";

export default function TaskSearch() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const timer = useRef(null);
  const go = (v) => {
    const next = new URLSearchParams(params.toString());
    if (v.trim()) next.set("q", v.trim());
    else next.delete("q");
    const s = next.toString();
    router.replace(s ? `${path}?${s}` : path, { scroll: false });
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-line bg-panel px-3.5 shadow-[var(--card-shadow)] sm:max-w-xs">
      <Icon name="search" size={14} className="shrink-0 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = setTimeout(() => go(v), 300);
        }}
        onKeyDown={(e) => e.key === "Escape" && (setQ(""), go(""))}
        placeholder="Search tasks — name, brand, person"
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
      />
      {q && (
        <button type="button" onClick={() => (setQ(""), go(""))} className="text-muted hover:text-ink" aria-label="Clear search">
          <Icon name="x" size={13} />
        </button>
      )}
    </label>
  );
}
