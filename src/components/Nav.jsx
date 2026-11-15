"use client";

// The app shell: a black floating icon rail on the left (desktop), a slim top bar with the page name,
// search, notifications and the profile, and a black pill tab bar on phones.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";

const isActive = (path, href) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
const activeItem = (path, items) => items.filter((it) => isActive(path, it.href)).sort((a, b) => b.href.length - a.href.length)[0];

function Badge({ n, on }) {
  if (!n) return null;
  return (
    <span className={`absolute -right-1 -top-1 min-w-[18px] rounded-full px-1 text-center text-[10px] font-semibold leading-[18px] tabular-nums ring-2 ring-[var(--rail)] ${on ? "bg-white text-brand" : "bg-brand text-white"}`}>
      {n > 9 ? "9+" : n}
    </span>
  );
}

function RailButton({ label, active, badge, children }) {
  return (
    <span className="group relative block">
      <span
        className={`relative grid h-10 w-10 place-items-center rounded-full transition duration-200 ${
          active ? "bg-brand text-white shadow-[0_0_0_4px_rgb(232_101_79/0.22),0_10px_22px_-6px_rgb(232_101_79/0.9)]" : "text-white/50 hover:bg-white/10 hover:text-white"
        }`}
      >
        {children}
        <Badge n={badge} on={active} />
      </span>
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[var(--rail)] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:translate-x-0 group-hover:opacity-100">
        {label}
        <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-[var(--rail)]" />
      </span>
    </span>
  );
}

/**
 * Desktop: the floating black icon rail.
 *   items   [{ href, label, icon, badge }] — the app's sections, top to bottom
 *   bottom  smaller sections pinned near the foot (Updates, Team, Feedback)
 *   tools   extra buttons at the very bottom (theme, sign out)
 */
export function Rail({ items, bottom = [], tools, logo }) {
  const path = usePathname();
  const current = activeItem(path, [...items, ...bottom]);
  const link = (it) => (
    <Link key={it.href} href={it.href} aria-label={it.label}>
      <RailButton label={it.label} active={current?.href === it.href} badge={it.badge}>
        <Icon name={it.icon} size={18} />
      </RailButton>
    </Link>
  );
  return (
    <aside className="fixed bottom-4 left-4 top-4 z-40 hidden w-[60px] flex-col items-center rounded-full bg-[var(--rail)] py-2.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.6)] md:flex">
      <Link href="/" aria-label="Home" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand shadow-[0_8px_20px_-6px_rgb(232_101_79/0.9)]">
        {logo}
      </Link>
      <nav className="mt-5 flex min-h-0 flex-1 flex-col items-center gap-1.5">
        {items.map(link)}
        {bottom.length > 0 && <span className="my-1.5 h-px w-6 shrink-0 bg-white/10" />}
        {bottom.map(link)}
      </nav>
      <div className="flex flex-col items-center gap-1.5">{tools}</div>
    </aside>
  );
}

/** A rail-styled button for the foot of the rail (theme, sign out). */
export function RailTool({ label, icon, onClick, type = "button" }) {
  return (
    <button type={type} onClick={onClick} aria-label={label}>
      <RailButton label={label}>
        <Icon name={icon} size={17} />
      </RailButton>
    </button>
  );
}

/** Desktop top bar: today's date and the page name on the left; search, bell and profile on the right. */
export function TopBar({ items, date, search, right }) {
  const path = usePathname();
  const router = useRouter();
  const input = useRef(null);
  const current = activeItem(path, items);
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
    <header className="hidden items-center gap-4 px-6 pt-5 md:flex">
      <div className="min-w-0">
        <p className="text-xs text-muted">{date}</p>
        <h2 className="mt-0.5 flex items-center gap-2 text-[17px] font-medium tracking-[-0.01em]">
          <Icon name={current?.icon || "home"} size={16} className="text-muted" />
          {current?.label || "Home"}
        </h2>
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        {search && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = input.current?.value.trim();
              router.push(q ? `/leads?view=list&q=${encodeURIComponent(q)}` : "/leads?view=list");
            }}
            className="flex h-11 w-[min(320px,30vw)] items-center gap-2.5 rounded-full bg-panel pl-4 pr-1.5 shadow-[var(--card-shadow)]"
          >
            <Icon name="search" size={16} className="text-muted" />
            <input ref={input} name="q" placeholder="Search leads, brands, phone…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
            <kbd className="rounded-full bg-panel-2 px-2 py-1 font-sans text-[10px] font-semibold text-muted">⌘K</kbd>
          </form>
        )}
        {right}
      </div>
    </header>
  );
}

/** Phone: a black pill tab bar; the first few sections, the rest behind "More". */
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
      <span className={`relative grid h-9 w-9 place-items-center rounded-full transition ${active ? "bg-brand text-white shadow-[0_6px_16px_-4px_rgb(232_101_79/0.9)]" : "text-white/55"}`}>
        <Icon name={it.icon} size={18} />
        <Badge n={it.badge} on={active} />
      </span>
      <span className={`text-[10px] font-medium ${active ? "text-white" : "text-white/55"}`}>{it.label.split(" ")[0]}</span>
    </span>
  );
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around rounded-[28px] bg-[var(--rail)] p-1.5 shadow-[0_20px_40px_-16px_rgb(0_0_0/0.6)]">
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
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
          <div className="rise absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto rounded-t-[32px] bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
            <div className="flex flex-col gap-1">
              {rest.map((it) => {
                const on = current?.href === it.href;
                return (
                  <Link key={it.href} href={it.href} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] ${on ? "bg-panel-2 font-medium" : ""}`}>
                    <span className={`grid h-9 w-9 place-items-center rounded-full ${on ? "bg-brand text-white" : "bg-panel-2 text-muted"}`}>
                      <Icon name={it.icon} size={17} />
                    </span>
                    <span className="flex-1">{it.label}</span>
                    {it.badge > 0 && <span className="min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{it.badge}</span>}
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
