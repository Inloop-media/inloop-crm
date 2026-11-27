// Requirements: ask your team lead (or manager / CBO) for what you need, get the files back, track it till it's done.
import { FilterPills, PageTop } from "@/components/Desk";
import RequirementBoard, { NewRequirement } from "@/components/RequirementBoard";
import { requireMember } from "@/lib/auth";
import { OPEN_REQ, listRequirements, memberNames, recipients, requirementCounts } from "@/lib/requirements";

export const metadata = { title: "Requirements" };

export default async function RequirementsPage({ searchParams }) {
  const sp = await searchParams;
  const me = await requireMember();
  const staff = me.role === "admin" || me.role === "ops";
  const [to, counts] = await Promise.all([recipients(me), requirementCounts(me.id)]);
  // Heads / team leads land on what was sent to them; everyone else on what they asked for
  const receives = staff || (me.ledGroups || []).length > 0 || (me.leadGroups || []).length > 0 || counts.inbox > 0;
  // …unless nothing is waiting on them but someone replied on what they asked for
  const box = ["inbox", "sent", "all"].includes(sp.box) && (sp.box !== "all" || staff) ? sp.box : receives && !(counts.inbox === 0 && counts.sentUnread) ? "inbox" : "sent";
  const show = sp.show === "closed" ? "closed" : "open";
  const { items, missing } = await listRequirements(me, box);
  const openCount = items.filter((r) => OPEN_REQ.includes(r.status)).length;
  const shown = items.filter((r) => (show === "open" ? OPEN_REQ.includes(r.status) : !OPEN_REQ.includes(r.status)));
  const names = await memberNames(items.flatMap((r) => [r.from_id, ...(r.history || []).flatMap((h) => [h.by, h.to, h.for])]));
  const href = (p) => `/requirements?${new URLSearchParams({ box, show, ...p })}`;

  return (
    <div className="page">
      <PageTop
        title="Requirements"
        sub="Need something to do your work? Ask your team lead — or your CBO when they're off — and track it till it's done."
        right={to.length > 0 && <NewRequirement recipients={to} />}
      />
      <div className="rise mb-4 flex flex-wrap items-center gap-2">
        <FilterPills
          items={[
            ...(receives ? [{ href: href({ box: "inbox" }), label: "Sent to me", count: counts.inbox, on: box === "inbox" }] : []),
            { href: href({ box: "sent" }), label: "Asked by me", count: counts.sent, on: box === "sent" },
            ...(staff ? [{ href: href({ box: "all" }), label: "Everyone", on: box === "all" }] : []),
          ]}
        />
        <FilterPills
          items={[
            { href: href({ show: "open" }), label: "Open", count: openCount, on: show === "open" },
            { href: href({ show: "closed" }), label: "Closed", count: items.length - openCount, on: show === "closed" },
          ]}
        />
      </div>
      {missing ? (
        <p className="card p-6 text-sm text-muted">Requirements aren&apos;t set up yet — run migration 019 in Supabase.</p>
      ) : (
        <RequirementBoard key={`${box}-${show}`} items={shown} meId={me.id} staff={staff} recipients={to} names={names} openId={sp.open} box={box} show={show} />
      )}
      {!to.length && box === "sent" && !missing && (
        <p className="mt-4 text-center text-xs text-muted">You don&apos;t have a team lead or manager yet. Once you&apos;re in a group with one (Team page), you can send them requirements.</p>
      )}
    </div>
  );
}
