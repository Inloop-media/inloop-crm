"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import { BrandMark } from "@/components/ui";

const isActive = (path, href) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function NavLink({ it, active }) {
  return (
    <Link href={it.href} className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-panel-2 font-medium text-ink" : "text-muted hover:bg-panel-2/60 hover:text-ink"}`}>
      {it.mark || <Icon name={it.icon} size={16} className={active ? "text-brand" : ""} />}
      <span className={`min-w-0 flex-1 truncate ${it.muted ? "opacity-60" : ""}`}>{it.label}</span>
      {it.badge > 0 && <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums text-on-brand">{it.badge}</span>}
    </Link>
  );
}

/**
 * Desktop: the left sidebar, ClickUp / Notion style.
 *   groups  [{ title, items }] — the app's sections
 *   brands  { items: [{ id, name, href, badge, muted }], allHref, addHref } — every client as a workspace
 *   bottom  small links pinned above the profile (Team, Feedback…)
 */
export function Sidebar({ groups, brands, bottom = [], footer, top }) {
  const path = usePathname();
  const params = useSearchParams();
  const brandActive = (href) => {
    const [p, q] = href.split("?");
    if (q) return path === p && params.get("brand") === new URLSearchParams(q).get("brand");
    return path === p || path.startsWith(`${p}/`);
  };
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-5">
      {top}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        {groups.map((g) => (
          <div key={g.title || "main"} className="flex flex-col gap-0.5">
            {g.title && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{g.title}</div>}
            {g.items.map((it) => (
              <NavLink key={it.href} it={it} active={isActive(path, it.href)} />
            ))}
          </div>
        ))}
        {brands && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between px-3 pb-1">
              <Link href={brands.allHref} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint hover:text-ink">
                Brands · {brands.items.length}
              </Link>
            </div>
            {brands.items.map((b) => (
              <NavLink key={b.id} it={{ ...b, label: b.name, mark: <BrandMark name={b.name} size={20} /> }} active={brandActive(b.href)} />
            ))}
            {!brands.items.length && <p className="px-3 py-2 text-xs text-faint">Brands show up here once they sign.</p>}
          </div>
        )}
      </div>
      {bottom.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-line pt-3">
          {bottom.map((it) => (
            <NavLink key={it.href} it={it} active={isActive(path, it.href)} />
          ))}
        </div>
      )}
      {footer}
    </nav>
  );
}

/** Phone: the first few sections in the bottom bar, the rest behind "More". */
export function PhoneTabs({ groups, brands, bottom = [] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  const all = [...groups.flatMap((g) => g.items), ...bottom];
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
            <Sidebar groups={groups} brands={brands} bottom={bottom} />
          </div>
        </div>
      )}
    </>
  );
}
