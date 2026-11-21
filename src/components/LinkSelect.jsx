"use client";
// A small dropdown that changes the page's filter (e.g. brand) by going to another URL.
import { useRouter } from "next/navigation";

/** options: [{ value, label, href }] */
export default function LinkSelect({ value, options, label, className = "" }) {
  const router = useRouter();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => router.push(options.find((o) => o.value === e.target.value)?.href || "?", { scroll: false })}
      className={`h-9 rounded-full border border-line bg-panel pl-3.5 pr-8 text-[13px] font-medium text-ink shadow-[var(--card-shadow)] outline-none ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
