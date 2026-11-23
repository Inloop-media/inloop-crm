// Brands: a title with the counts, one slim row of numbers across all clients, the filter, then a calm
// grid of brand cards (clients first, then the ones still onboarding).
import Link from "next/link";
import BrandCard from "@/components/BrandCard";
import BrandSearch from "@/components/BrandSearch";
import { HatchBar, RoundLink, Tile } from "@/components/Bold";
import AddBrands from "@/components/AddBrands";
import { FilterPills } from "@/components/Desk";
import { Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { unreadCounts } from "@/lib/chat";
import { canOnboard, canSeeBrands } from "@/lib/permissions";

export const metadata = { title: "Brands" };

export default async function BrandsPage({ searchParams }) {
  const me = await requireMember(canSeeBrands);
  const { show, q: rawQ = "" } = await searchParams;
  const q = String(rawQ).trim().toLowerCase();
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
  // Busiest clients first (late, then to check, then in work), the rest A–Z
  const busy = (b) =>
    (b.counts?.overdue || 0) * 1e4 +
    (b.counts?.review || 0) * 100 +
    (b.counts?.open || 0);
  const sortedActive = [...active].sort(
    (a, b) => busy(b) - busy(a) || a.name.localeCompare(b.name),
  );
  const all =
    show === "active"
      ? sortedActive
      : show === "onboarding"
        ? onboarding
        : [...sortedActive, ...onboarding];
  const list = q
    ? all.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.services || []).some((x) =>
            String(x.name || "")
              .toLowerCase()
              .includes(q),
          ),
      )
    : all;
  const withQ = (base) =>
    q
      ? `${base}${base.includes("?") ? "&" : "?"}q=${encodeURIComponent(rawQ)}`
      : base;
  const approvedPct = sum("total")
    ? Math.round((sum("done") / sum("total")) * 100)
    : 0;
  const attention = sortedActive.filter(
    (b) => (b.counts?.overdue || 0) + (b.counts?.review || 0) > 0,
  );
  const maxAttention = Math.max(
    1,
    ...attention.map((b) => (b.counts?.overdue || 0) + (b.counts?.review || 0)),
  );
  const busiest = busy(sortedActive[0] || {}) > 0 ? sortedActive[0].id : "";
  const totalUnread = Object.values(unread).reduce((n, c) => n + c, 0);

  return (
    <div className="page">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-normal leading-tight tracking-[-0.03em]">
            Brands
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            <span className="text-ink">{active.length}</span> clients ·{" "}
            <span className="text-ink">{onboarding.length}</span> onboarding
            {totalUnread ? (
              <>
                {" "}
                ·{" "}
                <span className="text-brand">
                  {totalUnread} unread messages
                </span>
              </>
            ) : null}
          </p>
        </div>
        {me.role === "admin" && <AddBrands />}
      </header>

      {brands.length === 0 ? (
        <div className="card rise">
          <Empty icon="brand">
            No brands yet. Add the brands you already handle with &quot;Add
            existing brands&quot;. New ones show up here once their MOU is
            signed.
          </Empty>
        </div>
      ) : (
        <>
          <div className="rise mb-6 grid gap-4 xl:grid-cols-12">
            {/* Hero */}
            <section className="card p-5 xl:col-span-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-muted">
                    Client work · {active.length} clients
                  </p>
                  <h2 className="mt-1 text-[26px] font-normal leading-tight tracking-[-0.02em]">
                    Keep every brand{" "}
                    <span className="text-brand">on track</span>
                  </h2>
                </div>
                <RoundLink href="/tasks" label="All tasks" />
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-[52px] font-normal leading-none tracking-[-0.03em] tabular-nums">
                  {sum("total")}
                </span>
                <span className="mb-1.5 text-sm text-muted">
                  tasks across clients
                </span>
                <span className="mb-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                  {approvedPct}% approved
                </span>
              </div>
              <div className="relative mt-8">
                <HatchBar pct={approvedPct} />
                <span
                  className="absolute -top-7 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${Math.min(94, Math.max(6, approvedPct))}%` }}
                >
                  <span className="rounded-md bg-solid px-1.5 py-0.5 text-[10px] font-medium text-on-solid">
                    {sum("done")} approved
                  </span>
                  <span className="h-6 w-px bg-ink" />
                </span>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <Tile
                  icon="tasks"
                  label="In work"
                  value={sum("open")}
                  note="being made now"
                  href="/tasks"
                />
                <Tile
                  icon="check"
                  label="To check"
                  value={sum("review")}
                  note="finished, waiting for you"
                  href="/tasks"
                />
                <Tile
                  icon="clock"
                  label="Late"
                  value={sum("overdue")}
                  note="past their due date"
                  href="/tasks"
                  tone="red"
                />
              </div>
            </section>

            {/* Needs attention */}
            <section className="card-coral flex flex-col p-5 xl:col-span-4">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-normal tracking-[-0.01em]">
                  Needs attention
                </h2>
                <RoundLink href="/tasks" label="Open tasks" light />
              </div>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-[64px] font-light leading-none tabular-nums">
                  {attention.length}
                </span>
                <span className="mb-2 text-xs leading-tight text-white/80">
                  of {active.length}
                  <br />
                  clients
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/75">
                Late work or work waiting to be checked
              </p>
              <div className="mt-auto flex flex-col gap-2.5 pt-5">
                {attention.slice(0, 4).map((b) => {
                  const n = (b.counts?.overdue || 0) + (b.counts?.review || 0);
                  return (
                    <Link
                      key={b.id}
                      href={`/brands/${b.id}`}
                      className="flex items-center gap-3 text-[11px] hover:opacity-90"
                    >
                      <span className="w-24 shrink-0 truncate text-white/90">
                        {b.name}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                        <span
                          className="block h-full rounded-full bg-white"
                          style={{ width: `${(n / maxAttention) * 100}%` }}
                        />
                      </span>
                      <span className="w-5 text-right font-medium tabular-nums">
                        {n}
                      </span>
                    </Link>
                  );
                })}
                {!attention.length && (
                  <p className="text-[12px] text-white/85">
                    All clear — nothing late or waiting ✓
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="rise mb-5 flex flex-wrap items-center justify-between gap-3">
            <FilterPills
              items={[
                {
                  label: "All",
                  count: brands.length,
                  href: withQ("/brands"),
                  on: !show,
                },
                {
                  label: "Clients",
                  count: active.length,
                  href: withQ("/brands?show=active"),
                  on: show === "active",
                },
                {
                  label: "Onboarding",
                  count: onboarding.length,
                  href: withQ("/brands?show=onboarding"),
                  on: show === "onboarding",
                },
              ]}
            />
            <BrandSearch />
          </div>

          {list.length ? (
            <div className="rise grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {list.map((b) => (
                <BrandCard
                  key={b.id}
                  b={b}
                  unread={unread[b.id]}
                  dark={b.id === busiest}
                />
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty icon="brand">
                {q ? `No brand matches “${rawQ}”.` : "No brands here."}
              </Empty>
            </div>
          )}
        </>
      )}
    </div>
  );
}
