import BrandCard from "@/components/BrandCard";
import { Empty, PageHeader, StatStrip } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { unreadCounts } from "@/lib/chat";
import { canOnboard, canSeeBrands } from "@/lib/permissions";

export const metadata = { title: "Brands" };

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
