"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";

const isActive = (path, href) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

/** Desktop: the main sections as a pill group in the top bar. */
export default function Nav({ items }) {
  const path = usePathname();
  return (
    <nav className="pill-group">
      {items.map((it) => {
        const active = isActive(path, it.href);
        return (
          <Link key={it.href} href={it.href} data-on={active} className="pill">
            {it.label}
            {it.badge > 0 && (
              <span
                className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums ${
                  active ? "bg-on-solid/20 text-on-solid" : "bg-brand text-on-brand"
                }`}
              >
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop: a slim icon rail of quick actions down the left edge. */
export function Rail({ actions }) {
  const path = usePathname();
  const params = useSearchParams();
  const here = `${path}${params.size ? `?${params}` : ""}`;
  return (
    <nav className="flex flex-col items-center gap-1 rounded-full bg-panel p-1.5 shadow-[var(--card-shadow)]">
      {actions.map((a) => {
        const active = a.match ? a.match(path, params) : here === a.href;
        return (
          <Link
            key={a.href}
            href={a.href}
            title={a.label}
            aria-label={a.label}
            className={`group relative grid h-9 w-9 place-items-center rounded-full transition ${active ? "solid" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
          >
            <Icon name={a.icon} size={16} />
            <span className="pointer-events-none absolute left-12 z-40 whitespace-nowrap rounded-full bg-solid px-2.5 py-1 text-xs text-on-solid opacity-0 transition group-hover:opacity-100">
              {a.label}
            </span>
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
    <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around rounded-full bg-panel/95 p-1.5 shadow-[var(--pop-shadow)] backdrop-blur-xl">
        {items.map((it) => {
          const active = isActive(path, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 transition ${active ? "solid" : "text-muted active:bg-panel-2"}`}
            >
              <span className="relative">
                <Icon name={it.icon} size={19} />
                {it.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-[17px] tabular-nums text-on-brand ring-2 ring-panel">
                    {it.badge > 9 ? "9+" : it.badge}
                  </span>
                )}
              </span>
              {/* With many sections the labels would squash — icons only (the active one keeps its label) */}
              <span className={`text-[10px] font-medium ${items.length > 6 && !active ? "sr-only" : ""}`}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop: the left sidebar — sections in named groups, like every task app people already know. */
export function Sidebar({ groups, footer, top }) {
  const path = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
      {top}
      {groups.map((g) => (
        <div key={g.title || "main"} className="flex flex-col gap-0.5">
          {g.title && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{g.title}</div>}
          {g.items.map((it) => {
            const active = isActive(path, it.href);
            return (
              <Link key={it.href} href={it.href} className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-panel-2 font-medium text-ink" : "text-muted hover:bg-panel-2/60 hover:text-ink"}`}>
                <Icon name={it.icon} size={16} className={active ? "text-brand" : ""} />
                <span className="flex-1">{it.label}</span>
                {it.badge > 0 && <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums text-on-brand">{it.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-auto">{footer}</div>
    </nav>
  );
}

/** Phone: the first few sections in the bottom bar, the rest behind "More". */
export function PhoneTabs({ groups }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  const all = groups.flatMap((g) => g.items);
  const main = all.slice(0, all.length > 5 ? 4 : 5);
  const more = all.length > 5;
  const moreActive = more && !main.some((it) => isActive(path, it.href)) && all.some((it) => isActive(path, it.href));
  const moreBadge = all.slice(4).reduce((n, it) => n + (it.badge || 0), 0);
  const tab = (it, active, onClick) => (
    <span className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 transition ${active ? "solid" : "text-muted active:bg-panel-2"}`} onClick={onClick}>
      <span className="relative">
        <Icon name={it.icon} size={19} />
        {it.badge > 0 && <span className="absolute -right-2.5 -top-1.5 min-w-[17px] rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-[17px] tabular-nums text-on-brand ring-2 ring-panel">{it.badge > 9 ? "9+" : it.badge}</span>}
      </span>
      <span className="text-[10px] font-medium">{it.label}</span>
    </span>
  );
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around rounded-full bg-panel/95 p-1.5 shadow-[var(--pop-shadow)] backdrop-blur-xl">
          {main.map((it) => (
            <Link key={it.href} href={it.href} className="flex flex-1">
              {tab(it, isActive(path, it.href))}
            </Link>
          ))}
          {more && (
            <button className="flex flex-1" onClick={() => setOpen(true)}>
              {tab({ icon: "list", label: "More", badge: moreBadge }, moreActive)}
            </button>
          )}
        </div>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
          <div className="rise absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto rounded-t-[32px] bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <Sidebar groups={groups} />
          </div>
        </div>
      )}
    </>
  );
}
