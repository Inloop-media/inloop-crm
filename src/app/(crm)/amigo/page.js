import Amigo from "@/components/AmigoLoader";
import { requireMember } from "@/lib/auth";
import { AMIGO_SUGGESTIONS, canUseAmigo } from "@/lib/amigo";
import { listBrands } from "@/lib/brands";
import { listMakers } from "@/lib/tasks";
import { canAssignTasks } from "@/lib/permissions";

export const metadata = { title: "Amigo" };

export default async function AmigoPage() {
  const me = await requireMember(canUseAmigo);
  const [brands, people] = canAssignTasks(me) ? await Promise.all([listBrands(), listMakers()]) : [[], []];
  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="page !pb-3">
      <Amigo
        meId={me.id}
        firstName={me.name.split(" ")[0]}
        initials={initials}
        suggestions={AMIGO_SUGGESTIONS}
        brands={brands.filter((b) => b.stage === "active").map((b) => ({ id: b.id, name: b.name }))}
        people={people}
      />
    </div>
  );
}
