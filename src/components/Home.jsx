// The pieces every dashboard is built from (layout "B"): a greeting, one row of three small numbers,
// then two columns — the work on the left, the team / meetings on the right. Empty sections hide
// themselves, so a quiet day shows a quiet screen.
import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";

const IST = "Asia/Kolkata";
const dateLine = new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "long", day: "numeric", month: "long" });

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "Good evening, Karan" + today's date (and a short line), the main buttons on the right. */
export function HomeHeader({ name, sub, actions }) {
  return (
    <header className="rise mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.025em]">
          {greeting()}, {String(name || "").split(" ")[0]}
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          {dateLine.format(new Date())}
          {sub ? ` · ${sub}` : ""}
        </p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * One row of (up to) three numbers. items: [{ label, value, href, tone: "red" | "amber" | undefined }]
 * A number only turns red / amber when it's above zero.
 */
/**
 * The numbers at the top of a page (option B): the first is the coral highlight card, red ones (late) are a
 * soft red, the rest plain. With an href the whole card opens that list ("Open list →").
 */
const COLS = { 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", 6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6", 7: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7", 8: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8" };

export function Counts({ items }) {
  // Tabs mode (Tasks page): the chosen card is the coral one; otherwise the first card is the highlight
  const tabs = items.some((it) => it.active !== undefined);
  return (
    <div className={`rise mb-5 grid gap-3 ${COLS[items.length] || "grid-cols-3"}`}>
      {items.map((it, i) => {
        const has = it.value > 0;
        const coral = tabs ? it.active : i === 0 && has;
        const look =
          coral
            ? "card-coral"
            : it.tone === "red" && has
              ? "card text-rose-700 dark:text-rose-300"
              : "card";
        const sub = coral ? "text-white/85" : it.tone === "red" && has ? "text-rose-700/80 dark:text-rose-300/80" : "text-muted";
        const num = coral ? "text-white" : !has ? "text-faint" : it.tone === "red" ? "text-rose-600 dark:text-rose-300" : "text-ink";
        const body = (
          <>
            <span className={`text-[12.5px] ${sub}`}>{it.label}</span>
            <span className={`text-[30px] font-medium leading-none tracking-[-0.02em] tabular-nums ${num}`}>{it.value}</span>
            {it.href && has && !tabs && (
              <span className={`mt-auto flex items-center gap-1 text-[12px] font-medium ${sub}`}>
                Open list <Icon name="arrow" size={12} />
              </span>
            )}
          </>
        );
        // Late: a soft red card (the card's own background is a sheen, so it's set here)
        const style = it.tone === "red" && has && !coral ? { background: "linear-gradient(rgb(244 63 94 / 0.1), rgb(244 63 94 / 0.1)), var(--card-sheen)", borderColor: "color-mix(in srgb, #f43f5e 22%, transparent)" } : undefined;
        const cls = `${look} flex ${tabs ? "min-h-[84px]" : "min-h-[112px]"} flex-col gap-2.5 px-4 py-3.5 transition hover:-translate-y-0.5`;
        return it.href ? (
          <Link key={it.label} href={it.href} scroll={false} aria-current={it.active ? "page" : undefined} className={cls} style={style}>
            {body}
          </Link>
        ) : (
          <div key={it.label} className={cls} style={style}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Left: the work. Right: the team, meetings, groups. Stacks on phones. */
export function TwoCol({ main, side }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      <aside className="flex min-w-0 flex-col gap-5">{side}</aside>
    </div>
  );
}

/** A titled card. Hidden when `count === 0` and no `empty` text is given. */
export function Block({ title, count, action, empty, children, className = "" }) {
  if (count === 0 && !empty) return null;
  return (
    <section className={`card rise min-w-0 p-5 ${className}`}>
      <header className="mb-1 flex items-center gap-2">
        <h2 className="text-[15px] font-medium">{title}</h2>
        {count > 0 && <span className="text-[13px] text-muted tabular-nums">{count}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </header>
      {count === 0 ? <p className="py-4 text-[13px] text-muted">{empty}</p> : children}
    </section>
  );
}

export function SeeAll({ href, children = "See all" }) {
  return (
    <Link href={href} className="flex items-center gap-1 text-[12px] text-muted hover:text-ink">
      {children} <Icon name="arrow" size={12} />
    </Link>
  );
}

/** A plain row: icon, title, one line under it, and one thing on the right. */
export function Row({ href, icon = "tasks", tone, title, sub, right }) {
  const iconCls = tone === "red" ? "bg-rose-500/10 text-rose-500" : tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-panel-2 text-muted";
  return (
    <li className="border-b border-line last:border-0">
      <Link href={href} className="group flex items-center gap-3 py-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconCls}`}>
          <Icon name={icon} size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium group-hover:text-brand">{title}</span>
          {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
        </span>
        {right ?? <Icon name="chevron" size={14} className="shrink-0 -rotate-90 text-faint group-hover:text-ink" />}
      </Link>
    </li>
  );
}

/** people: [{ id, name, open, late }] — who has how much, busiest first. */
export function TeamLoad({ people, href = "/tasks?view=team", title = "Team" }) {
  if (!people.length) return null;
  const max = Math.max(1, ...people.map((p) => p.open));
  return (
    <Block title={title} action={<SeeAll href={href} />}>
      <ul className="mt-2 flex flex-col gap-3">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Avatar name={p.name} size={28} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {p.open} open{p.late ? <span className="text-rose-500"> · {p.late} late</span> : ""}
                </span>
              </span>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-panel-2">
                <span className={`block h-full rounded-full ${p.late ? "bg-rose-500" : "bg-ink/70"}`} style={{ width: `${Math.max(p.open ? 6 : 0, (p.open / max) * 100)}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Block>
  );
}
