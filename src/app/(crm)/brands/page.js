import Link from "next/link";
import BrandCard from "@/components/BrandCard";
import AddBrands from "@/components/AddBrands";
import Icon from "@/components/Icon";
import { FilterPills, PageTop } from "@/components/Desk";
import { Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { unreadCounts } from "@/lib/chat";
import { canOnboard, canSeeBrands } from "@/lib/permissions";

export const metadata = { title: "Brands" };

export default async function BrandsPage({ searchParams }) {
  const me = await requireMember(canSeeBrands);
  const { show } = await searchParams;
  // Onboarding (MOU) lives on the lead page, which only admin / ops open
  const brands = (await listBrands()).filter(
    (b) => b.stage === "active" || canOnboard(me),
  );
  const active = brands.filter((b) => b.stage === "active");
  const onboarding = brands.filter((b) => b.stage !== "active");
  const unread = await unreadCounts(
    active.map((b) => b.id),
    me.id,
  );
  const sum = (k) => active.reduce((n, b) => n + (b.counts?.[k] || 0), 0);
  const list =
    show === "active"
      ? active
      : show === "onboarding"
        ? onboarding
        : [...active, ...onboarding];
  const totalUnread = Object.values(unread).reduce((n, c) => n + c, 0);

  const glance = [
    {
      label: "Active clients",
      value: active.length,
      total: brands.length,
      icon: "brand",
      tone: "coral",
    },
    {
      label: "Onboarding",
      value: onboarding.length,
      total: brands.length,
      icon: "mail",
      tone: "dark",
    },
    {
      label: "Approved work",
      value: sum("done"),
      total: sum("total"),
      icon: "check",
      tone: "soft",
    },
    {
      label: "Late tasks",
      value: sum("overdue"),
      total: Math.max(1, sum("open")),
      icon: "clock",
      tone: "line",
    },
  ];

  return (
    <div className="page">
      <PageTop
        title="Brands"
        sub={`${active.length} active · ${onboarding.length} onboarding${totalUnread ? ` · ${totalUnread} unread messages` : ""}`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {me.role === "admin" && <AddBrands />}
            <FilterPills
              items={[
                {
                  label: "All",
                  count: brands.length,
                  href: "/brands",
                  on: !show,
                },
                {
                  label: "Active",
                  count: active.length,
                  href: "/brands?show=active",
                  on: show === "active",
                },
                {
                  label: "Onboarding",
                  count: onboarding.length,
                  href: "/brands?show=onboarding",
                  on: show === "onboarding",
                },
              ]}
            />
          </div>
        }
      />

      {brands.length === 0 ? (
        <div className="card rise">
          <Empty icon="brand">
            No brands yet. Add the brands you already handle with &quot;Add
            existing brands&quot;. New ones show up here once their MOU is
            signed.
          </Empty>
        </div>
      ) : (
        <div className="rise grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {list.map((b, i) => (
              <BrandCard key={b.id} b={b} i={i} unread={unread[b.id]} />
            ))}
          </div>

          <aside className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-normal tracking-[-0.01em]">
                At a glance
              </h2>
              <Link
                href="/tasks"
                aria-label="Tasks"
                className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-muted hover:text-ink"
              >
                <Icon name="arrow" size={13} className="-rotate-45" />
              </Link>
            </div>
            <ul className="mt-4 flex flex-col gap-4">
              {glance.map((g) => (
                <li key={g.label} className="flex items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      g.tone === "coral"
                        ? "card-coral !rounded-xl !shadow-none"
                        : g.tone === "dark"
                          ? "bg-[#1c1c1f] text-white"
                          : g.tone === "soft"
                            ? "bg-brand/15 text-brand"
                            : "bg-panel-2 text-muted"
                    }`}
                  >
                    <Icon name={g.icon} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium">{g.label}</span>
                      <span className="text-[11px] tabular-nums text-muted">
                        {g.value}
                      </span>
                    </div>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-panel-2">
                      <span
                        className={`block h-full rounded-full ${g.tone === "dark" ? "bg-ink" : "bg-brand"}`}
                        style={{
                          width: `${g.total ? Math.min(100, (g.value / g.total) * 100) : 0}%`,
                        }}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <span className="text-[32px] font-light leading-none tabular-nums">
                {sum("open")}
              </span>
              <span className="text-xs leading-tight text-muted">
                tasks in work
                <br />
                across all clients
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
