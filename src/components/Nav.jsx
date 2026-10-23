"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ items }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${active ? "bg-panel-2 text-white" : "text-muted hover:bg-panel-2/60 hover:text-white"}`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
