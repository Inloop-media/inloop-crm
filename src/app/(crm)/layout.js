import Logo from "@/components/Logo";
import Nav from "@/components/Nav";
import { requireMember } from "@/lib/auth";
import { canManageTeam } from "@/lib/permissions";
import { ROLES } from "@/lib/constants";

export default async function CrmLayout({ children }) {
  const me = await requireMember();
  const items = [{ href: "/leads", label: "Leads" }];
  if (canManageTeam(me)) items.push({ href: "/team", label: "Team" });

  return (
    <div className="min-h-svh md:grid md:grid-cols-[220px_1fr]">
      <aside className="flex items-center justify-between gap-4 border-b border-line bg-panel px-4 py-3 md:sticky md:top-0 md:h-svh md:flex-col md:items-stretch md:justify-start md:border-b-0 md:border-r md:px-3 md:py-5">
        <div className="md:px-2">
          <Logo />
        </div>
        <div className="flex-1 md:mt-8">
          <Nav items={items} />
        </div>
        <div className="flex items-center gap-3 md:flex-col md:items-stretch md:gap-2 md:border-t md:border-line md:px-2 md:pt-4">
          <div className="hidden min-w-0 md:block">
            <div className="truncate text-sm">{me.name}</div>
            <div className="truncate text-xs text-muted">{ROLES.find((r) => r.id === me.role)?.label}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="text-xs text-muted hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
