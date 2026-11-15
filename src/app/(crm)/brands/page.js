import Link from "next/link";
import Icon from "@/components/Icon";
import { Avatar, Empty, PageHeader, StatStrip } from "@/components/ui";
import { Progress } from "@/components/Tasks";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { unreadCounts } from "@/lib/chat";
import { canOnboard, canSeeBrands } from "@/lib/permissions";
import { BRAND_STAGES } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

export const metadata = { title: "Brands" };

function BrandCard({ b, unread = 0 }) {
  const c = b.counts;
  const stage = BRAND_STAGES[b.stage];
  const href = b.stage === "active" ? `/brands/${b.id}` : `/leads/${b.lead?.id}#onboarding`;
  return (
    <Link href={href} className="card card-hover group flex flex-col gap-5 p-6">
      <div className="flex items-start gap-3">
        <Avatar name={b.name} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-medium tracking-[-0.01em]">{b.name}</div>
          <div className="truncate text-xs text-muted">{(b.services || []).map((s) => s.name).join(" · ") || "No services listed"}</div>
        </div>
        {unread > 0 ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
            <Icon name="chat" size={12} /> {unread} new
          </span>
        ) : (
          <span className={`tint-${stage.tint} shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium`}>{stage.label}</span>
        )}
      </div>
      {b.stage === "active" ? (
        <>
          <Progress done={c.done} total={c.total} />
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["In work", c.open, ""],
              ["Review", c.review, ""],
              ["Client", c.client, ""],
              ["Overdue", c.overdue, c.overdue ? "text-rose-400" : ""],
            ].map(([l, v, cls]) => (
              <div key={l} className="well px-1 py-2">
                <div className={`text-base font-medium ${cls}`}>{v}</div>
                <div className="text-[10px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          {b.assigners?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <span>Assigned by</span>
              {b.assigners.map(([name, n]) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-full bg-panel-2 py-0.5 pl-0.5 pr-2">
                  <Avatar name={name} size={16} />
                  {name.split(" ")[0]} <b className="font-semibold text-ink">{n}</b>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Onboarded {fmtDay(b.onboarded_at)}</span>
            <Icon name="arrow" size={14} className="transition group-hover:translate-x-1" />
          </div>
        </>
      ) : (
        <div className="well flex items-center justify-between p-3.5 text-xs text-muted">
          {b.stage === "mou_sent" ? `MOU sent ${fmtDay(b.mou_sent_at)} — waiting for the signature` : "MOU being drafted"}
          <Icon name="arrow" size={14} />
        </div>
      )}
    </Link>
  );
}

export default async function BrandsPage() {
  const me = await requireMember(canSeeBrands);
  // Onboarding (MOU) lives on the lead page, which only admin / ops open
  const brands = (await listBrands()).filter((b) => b.stage === "active" || canOnboard(me));
  const active = brands.filter((b) => b.stage === "active");
  const onboarding = brands.filter((b) => b.stage !== "active");
  const unread = await unreadCounts(active.map((b) => b.id), me.id);
  const sum = (k) => active.reduce((n, b) => n + b.counts[k], 0);

  return (
    <div className="page">
      <PageHeader kicker="Clients" title="Brands">
        <StatStrip
          className="mt-5"
          items={[
            { label: "Active brands", value: active.length, icon: "brand" },
            { label: "Onboarding", value: onboarding.length, icon: "mail", tint: "amber" },
            { label: "Approved work", value: sum("done"), icon: "check", tint: "green" },
            { label: "Overdue tasks", value: sum("overdue"), icon: "clock", tint: "pink" },
          ]}
        />
      </PageHeader>

      {brands.length === 0 ? (
        <div className="card rise rise-2">
          <Empty icon="brand">No brands yet. When a lead is marked Won, its MOU is drafted on the lead page — once it&apos;s signed the brand shows up here.</Empty>
        </div>
      ) : (
        <div className="rise rise-2 flex flex-col gap-8">
          {active.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {active.map((b) => (
                <BrandCard key={b.id} b={b} unread={unread[b.id]} />
              ))}
            </div>
          )}
          {onboarding.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted">Onboarding</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {onboarding.map((b) => (
                  <BrandCard key={b.id} b={b} unread={unread[b.id]} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
