// Brands: a title with the counts, one slim row of numbers across all clients, the filter, then a calm
// grid of brand cards (clients first, then the ones still onboarding).
import Link from "next/link";
import BrandCard from "@/components/BrandCard";
import Icon from "@/components/Icon";
import AddBrands from "@/components/AddBrands";
import { FilterPills } from "@/components/Desk";
import { Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { unreadCounts } from "@/lib/chat";
import { canOnboard, canSeeBrands } from "@/lib/permissions";

export const metadata = { title: "Brands" };

const TONE = {
  red: ["bg-rose-500/12 text-rose-500", "text-rose-500"],
  amber: ["bg-amber-500/12 text-amber-500", "text-amber-500"],
  green: ["bg-emerald-500/12 text-emerald-500", ""],
};

/** One card split in four: each number with a small icon tile; zero stays quiet. */
function Summary({ items }) {
  return (
    <div className="rise card mb-6 grid grid-cols-2 overflow-hidden !p-0 md:grid-cols-4">
      {items.map((s, i) => {
        const [tile, num] = (s.value && TONE[s.tone]) || ["bg-panel-2 text-muted", ""];
        const body = (
          <>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tile}`}>
              <Icon name={s.icon || "tasks"} size={16} />
            </span>
            <span className="min-w-0">
              <span className={`block text-[24px] font-light leading-none tracking-[-0.02em] tabular-nums ${num}`}>{s.value}</span>
              <span className="mt-1 block truncate text-[12px] text-muted">{s.label}</span>
            </span>
            {s.href && <Icon name="arrow" size={12} className="ml-auto -rotate-45 text-faint opacity-0 transition group-hover:opacity-100" />}
          </>
        );
        const cls = `group flex items-center gap-3.5 px-5 py-4 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`;
        return s.href ? (
          <Link key={s.label} href={s.href} className={`${cls} transition hover:bg-panel-2/60`}>
            {body}
          </Link>
        ) : (
          <div key={s.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export default async function BrandsPage({ searchParams }) {
  const me = await requireMember(canSeeBrands);
  const { show } = await searchParams;
  // Onboarding (MOU) lives on the lead page, which only admin / ops open
  const brands = (await listBrands()).filter((b) => b.stage === "active" || canOnboard(me));
  const active = brands.filter((b) => b.stage === "active");
  const onboarding = brands.filter((b) => b.stage !== "active");
  const unread = await unreadCounts(
    active.map((b) => b.id),
    me.id
  );
  const sum = (k) => active.reduce((n, b) => n + (b.counts?.[k] || 0), 0);
  // Busiest clients first (late, then to check, then in work), the rest A–Z
  const busy = (b) => (b.counts?.overdue || 0) * 1e4 + (b.counts?.review || 0) * 100 + (b.counts?.open || 0);
  const sortedActive = [...active].sort((a, b) => busy(b) - busy(a) || a.name.localeCompare(b.name));
  const list = show === "active" ? sortedActive : show === "onboarding" ? onboarding : [...sortedActive, ...onboarding];
  const totalUnread = Object.values(unread).reduce((n, c) => n + c, 0);

  return (
    <div className="page">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em]">Brands</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            <span className="text-ink">{active.length}</span> clients · <span className="text-ink">{onboarding.length}</span> onboarding
            {totalUnread ? (
              <>
                {" "}
                · <span className="text-brand">{totalUnread} unread messages</span>
              </>
            ) : null}
          </p>
        </div>
        {me.role === "admin" && <AddBrands />}
      </header>

      {brands.length === 0 ? (
        <div className="card rise">
          <Empty icon="brand">No brands yet. Add the brands you already handle with &quot;Add existing brands&quot;. New ones show up here once their MOU is signed.</Empty>
        </div>
      ) : (
        <>
          <Summary
            items={[
              { label: "Tasks in work", value: sum("open"), icon: "tasks", href: "/tasks" },
              { label: "To check", value: sum("review"), tone: "amber", icon: "check", href: "/tasks" },
              { label: "Late", value: sum("overdue"), tone: "red", icon: "clock", href: "/tasks" },
              { label: "Approved so far", value: sum("done"), tone: "green", icon: "sparkle" },
            ]}
          />

          <FilterPills
            className="rise mb-5"
            items={[
              { label: "All", count: brands.length, href: "/brands", on: !show },
              { label: "Clients", count: active.length, href: "/brands?show=active", on: show === "active" },
              { label: "Onboarding", count: onboarding.length, href: "/brands?show=onboarding", on: show === "onboarding" },
            ]}
          />

          {list.length ? (
            <div className="rise grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {list.map((b) => (
                <BrandCard key={b.id} b={b} unread={unread[b.id]} />
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty icon="brand">No brands here.</Empty>
            </div>
          )}
        </>
      )}
    </div>
  );
}
