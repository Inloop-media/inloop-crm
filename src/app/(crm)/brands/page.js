// Brands: a title with the counts, one slim row of numbers across all clients, the filter, then a calm
// grid of brand cards (clients first, then the ones still onboarding).
import Link from "next/link";
import BrandCard from "@/components/BrandCard";
import AddBrands from "@/components/AddBrands";
import { FilterPills } from "@/components/Desk";
import { Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { unreadCounts } from "@/lib/chat";
import { canOnboard, canSeeBrands } from "@/lib/permissions";

export const metadata = { title: "Brands" };

function Summary({ items }) {
  return (
    <div className="rise mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((s) => {
        const body = (
          <>
            <span className="text-[12px] text-muted">{s.label}</span>
            <span className={`text-[26px] font-light leading-none tracking-[-0.02em] tabular-nums ${s.value && s.tone === "red" ? "text-rose-500" : s.value && s.tone === "amber" ? "text-amber-500" : ""}`}>{s.value}</span>
          </>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="card card-hover flex flex-col gap-2 px-4 py-3.5">
            {body}
          </Link>
        ) : (
          <div key={s.label} className="card flex flex-col gap-2 px-4 py-3.5">
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
              { label: "Tasks in work", value: sum("open"), href: "/tasks" },
              { label: "To check", value: sum("review"), tone: "amber", href: "/tasks" },
              { label: "Late", value: sum("overdue"), tone: "red", href: "/tasks" },
              { label: "Approved so far", value: sum("done") },
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
            <div className="rise grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
