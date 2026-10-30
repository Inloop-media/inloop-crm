"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

const isActive = (path, href) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

/** Desktop sidebar links. */
export default function Nav({ items }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active = isActive(path, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active
                ? "bg-gradient-to-r from-white/[0.09] to-white/[0.02] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]"
                : "text-muted hover:bg-white/[0.04] hover:text-ink"
            }`}
          >
            {active && <span className="absolute inset-y-2.5 -left-3 w-[3px] rounded-r-full bg-brand shadow-[0_0_12px_2px] shadow-brand/60" />}
            <span
              className={`grid h-7 w-7 place-items-center rounded-lg transition ${
                active ? "bg-brand/15 text-brand-soft" : "text-muted group-hover:text-ink"
              }`}
            >
              <Icon name={it.icon} size={16} />
            </span>
            <span className="font-medium">{it.label}</span>
            {it.badge > 0 && (
              <span className="ml-auto min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums text-on-brand shadow-[0_0_14px] shadow-brand/50">
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone: a floating glass tab bar above the iPhone home indicator. */
export function TabBar({ items }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-30 md:hidden">
      <div className="glass mx-auto flex max-w-md items-stretch justify-around rounded-[26px] p-1.5">
        {items.map((it) => {
          const active = isActive(path, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 transition ${
                active ? "bg-white/[0.08] text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-muted active:bg-white/[0.05]"
              }`}
            >
              <span className="relative">
                <Icon name={it.icon} size={20} className={active ? "text-brand-soft" : ""} />
                {it.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-[17px] tabular-nums text-on-brand ring-2 ring-[#0e0e14]">
                    {it.badge > 9 ? "9+" : it.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium tracking-wide">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
