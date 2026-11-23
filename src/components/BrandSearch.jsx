"use client";
// Brands page search: filters the cards as you type (name or service), kept in the URL as ?q=.
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";

export default function BrandSearch({ placeholder = "Search brands or services" }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [pending, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (q.trim()) p.set("q", q.trim());
      else p.delete("q");
      start(() => router.replace(p.toString() ? `${path}?${p}` : path, { scroll: false }));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q]);

  return (
    <div className="relative w-full sm:w-72">
      <Icon name="search" size={14} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 ${pending ? "animate-pulse text-brand" : "text-faint"}`} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="field !rounded-full py-2 !pl-9 !pr-9" aria-label="Search brands" />
      {q && (
        <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-faint hover:bg-panel-2 hover:text-ink">
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  );
}
