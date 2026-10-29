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
            className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-panel-2 text-ink" : "text-muted hover:bg-panel-2/60 hover:text-ink"
            }`}
          >
            {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" />}
            <Icon name={it.icon} className={active ? "text-brand" : ""} />
            <span>{it.label}</span>
            {it.badge > 0 && (
              <span className="ml-auto min-w-5 rounded-full bg-brand/20 px-1.5 text-center text-[11px] font-medium tabular-nums text-brand">{it.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone: app-style tab bar pinned to the bottom, above the iPhone home indicator. */
export function TabBar({ items }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/[0.06] bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {items.map((it) => {
          const active = isActive(path, it.href);
          return (
            <Link key={it.href} href={it.href} className="group relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5">
              <span
                className={`relative grid h-8 w-14 place-items-center rounded-full transition ${
                  active ? "bg-brand/15 text-brand" : "text-muted group-active:bg-ink/[0.05]"
                }`}
              >
                <Icon name={it.icon} size={20} />
                {it.badge > 0 && (
                  <span className="absolute -top-1 right-2 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-[18px] tabular-nums text-on-brand ring-2 ring-bg">
                    {it.badge > 9 ? "9+" : it.badge}
                  </span>
                )}
              </span>
              <span className={`text-[10.5px] font-medium tracking-wide ${active ? "text-ink" : "text-muted"}`}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
