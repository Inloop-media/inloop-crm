"use client";
// A small dropdown whose options are links (sort / filter that live in the URL).
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function SelectNav({ label, value, options, className = "" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className={`relative inline-flex items-center gap-2 text-xs text-muted ${pending ? "opacity-60" : ""} ${className}`}>
      {label && <span className="whitespace-nowrap">{label}</span>}
      <select
        value={value}
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value);
          if (o) start(() => router.push(o.href, { scroll: false }));
        }}
        className="cursor-pointer appearance-none rounded-full border border-line bg-panel py-1.5 pl-3 pr-8 text-xs font-medium text-ink outline-none transition hover:border-line-strong focus:border-brand/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 text-muted" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
