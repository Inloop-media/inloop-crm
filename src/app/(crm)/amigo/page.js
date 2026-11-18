import Amigo from "@/components/AmigoLoader";
import { requireMember } from "@/lib/auth";
import { AMIGO_QUESTIONS, canUseAmigo } from "@/lib/amigo";
import { listBrands } from "@/lib/brands";
import { listMakers } from "@/lib/tasks";
import { canAssignTasks } from "@/lib/permissions";

export const metadata = { title: "Amigo" };

export default async function AmigoPage() {
  const me = await requireMember(canUseAmigo);
  const [brands, people] = canAssignTasks(me) ? await Promise.all([listBrands(), listMakers(me)]) : [[], []];
  const activeBrands = brands.filter((b) => b.stage === "active");
  const somePerson = (people.find((p) => p.id !== me.id) || people[0])?.name.split(" ")[0] || "Riya";
  const someBrand = activeBrands[0]?.name || "Shadowe";
  const questions = AMIGO_QUESTIONS.map(([group, qs]) => [group, qs.map((q) => q.replace("{person}", somePerson).replace("{brand}", someBrand))]);
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
        questions={questions}
        brands={activeBrands.map((b) => ({ id: b.id, name: b.name }))}
        people={people}
      />
    </div>
  );
}
