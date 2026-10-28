"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

export default function Nav({ items }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map((it) => {
        const active = it.href === "/" ? path === "/" : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-panel-2 text-white" : "text-muted hover:bg-panel-2/60 hover:text-white"
            }`}
          >
            {active && <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-brand md:block" />}
            <Icon name={it.icon} className={active ? "text-brand" : ""} />
            <span className="hidden sm:inline">{it.label}</span>
            {it.badge > 0 && (
              <span className="ml-auto hidden min-w-5 rounded-full bg-brand/20 px-1.5 text-center text-[11px] font-medium tabular-nums text-brand sm:inline">
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
