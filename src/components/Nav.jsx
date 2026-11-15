"use client";

// The app shell, like an admin console: a full-width top bar (menu, logo, search, theme, bell, you),
// a grouped sidebar with labels on the left (MAIN / SALES / CLIENTS / ADMIN) that folds down to icons,
// and a pill tab bar on phones.
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";

const isActive = (path, href) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
const activeItem = (path, items) => items.filter((it) => isActive(path, it.href)).sort((a, b) => b.href.length - a.href.length)[0];
const FOLD_KEY = "crm_sidebar_folded";

function Badge({ n, className = "" }) {
  if (!n) return null;
  return <span className={`min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-semibold leading-[18px] tabular-nums text-white ${className}`}>{n > 99 ? "99+" : n}</span>;
}

/** Is the sidebar folded down to icons? (remembered on this device) */
const subscribe = (cb) => {
  window.addEventListener("crm-fold", cb);
  return () => window.removeEventListener("crm-fold", cb);
};
const folded = () => {
  try {
    return localStorage.getItem(FOLD_KEY) === "1";
  } catch {
    return false;
  }
};
export function useFold() {
  return useSyncExternalStore(subscribe, folded, () => false);
}
function toggleFold() {
  try {
    localStorage.setItem(FOLD_KEY, localStorage.getItem(FOLD_KEY) === "1" ? "0" : "1");
  } catch {}
  window.dispatchEvent(new Event("crm-fold"));
}

/**
 * Desktop sidebar.
 *   groups  [{ title, items: [{ href, label, icon, badge, tag }] }]
 *   bottom  extra buttons at the foot (sign out)
 */
export function Sidebar({ groups, bottom }) {
  const path = usePathname();
  const fold = useFold();
  const current = activeItem(path, groups.flatMap((g) => g.items));
  return (
    <aside className={`hidden shrink-0 flex-col rounded-2xl border border-line bg-panel py-3 transition-[width] duration-200 md:flex ${fold ? "w-[64px] px-2" : "w-[228px] px-3"}`}>
      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            {fold ? <span className="mx-auto mb-1 h-px w-6 bg-line" /> : <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{g.title}</div>}
            {g.items.map((it) => {
              const on = current?.href === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  title={fold ? it.label : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] transition ${fold ? "justify-center px-0" : "px-2.5"} ${
                    on ? "bg-brand/12 font-medium text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand" : "text-muted hover:bg-panel-2 hover:text-ink"
                  }`}
                >
                  <Icon name={it.icon} size={16} className={on ? "text-brand" : ""} />
                  {!fold && <span className="min-w-0 flex-1 truncate">{it.label}</span>}
                  {!fold && it.tag && <span className="rounded-md border border-brand/40 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-brand">{it.tag}</span>}
                  {it.badge > 0 && (fold ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" /> : <Badge n={it.badge} />)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-3 border-t border-line pt-3">{bottom}</div>
    </aside>
  );
}

/** A sidebar-styled button for the foot (sign out). */
export function SideButton({ label, icon, type = "button", onClick }) {
  const fold = useFold();
  return (
    <button type={type} onClick={onClick} title={fold ? label : undefined} className={`flex w-full items-center gap-2.5 rounded-lg py-2 text-[13px] text-muted transition hover:bg-panel-2 hover:text-ink ${fold ? "justify-center" : "px-2.5"}`}>
      <Icon name={icon} size={16} />
      {!fold && label}
    </button>
  );
}

/** Desktop top bar: menu + logo on the left; search, theme, bell and you on the right. */
export function TopBar({ logo, search, right }) {
  const router = useRouter();
  const input = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <header className="hidden h-14 shrink-0 items-center gap-3 rounded-2xl border border-line bg-panel px-3 md:flex">
      <button onClick={toggleFold} aria-label="Fold the sidebar" className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-ink">
        <Icon name="list" size={17} />
      </button>
      <Link href="/" className="flex items-center gap-2">
        {logo}
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {search && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = input.current?.value.trim();
              router.push(q ? `/leads?view=list&q=${encodeURIComponent(q)}` : "/leads?view=list");
            }}
            className="flex h-9 w-[min(280px,26vw)] items-center gap-2 rounded-lg border border-line bg-panel-2 pl-3 pr-1.5"
          >
            <Icon name="search" size={14} className="text-muted" />
            <input ref={input} name="q" placeholder="Search…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
            <kbd className="rounded-md border border-line bg-panel px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted">⌘K</kbd>
          </form>
        )}
        {right}
      </div>
    </header>
  );
}

/** Phone: a pill tab bar; the first few sections, the rest behind "More". */
export function PhoneTabs({ items, bottom = [] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  const all = [...items, ...bottom];
  const main = all.slice(0, all.length > 5 ? 4 : 5);
  const rest = all.length > 5 ? all.slice(4) : [];
  const current = activeItem(path, all);
  const moreActive = rest.some((it) => it.href === current?.href);
  const moreBadge = rest.reduce((n, it) => n + (it.badge || 0), 0);
  const tab = (it, active) => (
    <span className="flex flex-1 flex-col items-center gap-1 py-1">
      <span className={`relative grid h-9 w-9 place-items-center rounded-full transition ${active ? "bg-solid text-on-solid" : "text-muted"}`}>
        <Icon name={it.icon} size={18} />
        {it.badge > 0 && <Badge n={it.badge} className="absolute -right-1.5 -top-1" />}
      </span>
      <span className={`text-[10px] font-medium ${active ? "text-ink" : "text-muted"}`}>{it.label.split(" ")[0]}</span>
    </span>
  );
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around rounded-[24px] border border-line bg-panel/95 p-1.5 shadow-[var(--pop-shadow)] backdrop-blur-xl">
          {main.map((it) => (
            <Link key={it.href} href={it.href} className="flex flex-1">
              {tab(it, current?.href === it.href)}
            </Link>
          ))}
          {rest.length > 0 && (
            <button className="flex flex-1" onClick={() => setOpen(true)}>
              {tab({ icon: "list", label: "More", badge: moreBadge }, moreActive)}
            </button>
          )}
        </div>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="rise absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto rounded-t-[28px] border-t border-line bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex flex-col gap-1">
              {rest.map((it) => {
                const on = current?.href === it.href;
                return (
                  <Link key={it.href} href={it.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] ${on ? "bg-panel-3 font-medium" : ""}`}>
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-panel-2 text-muted">
                      <Icon name={it.icon} size={17} />
                    </span>
                    <span className="flex-1">{it.label}</span>
                    <Badge n={it.badge} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
