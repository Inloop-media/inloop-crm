// The tasks desk: search + filters (brand, person, type, assigned on, given by me), the number cards as
// tabs, and the one list that's picked. Used on the Tasks page and on the dashboards (server component).
import Link from "next/link";
import { FilterPills, Section, TaskLine } from "@/components/Desk";
import { Counts } from "@/components/Home";
import LinkSelect from "@/components/LinkSelect";
import ShowMore from "@/components/ShowMore";
import TaskSearch from "@/components/TaskSearch";
import { fromCalendar, kindPlural } from "@/lib/constants";
import { filterHref, filterTasks } from "@/lib/taskFilters";

/**
 * base       the page's path ("/tasks" or "/")
 * keep       params this page keeps when filters change (e.g. { view: "board" }, { who: "all" })
 * extra      more controls for the filter row (e.g. My team / Everyone)
 * showList   false on the board view: just the filters
 * checkRow   (task) => a richer row for the To check tab (e.g. with Approve / Send back on the dashboard)
 * member     the person doing the work: Do now / Coming up / Waiting / Completed tabs
 * rowFor     (task) => the row for every tab (e.g. with Start / Upload & submit for the person doing it)
 */
export default function TaskDesk({ me, sp = {}, base = "/tasks", all, active = [], head = false, lead = false, member = false, keep = {}, extra = null, showList = true, checkRow = null, rowFor = null }) {
  const f = filterTasks({ all, sp, me, active, lead, member });
  const href = (o) => filterHref(base, f, sp, keep, o);
  const { pick } = f;
  return (
    <>
      <div className="rise mb-5 flex flex-wrap items-center gap-2">
        <TaskSearch />
        <FilterPills
          items={[
            { label: "All work", count: f.byPerson.length, href: href({ src: "" }), on: !f.src },
            { label: "Content calendar", count: f.byPerson.filter(fromCalendar).length, href: href({ src: "calendar" }), on: f.src === "calendar" },
            { label: "Other tasks", count: f.byPerson.filter((t) => !fromCalendar(t)).length, href: href({ src: "other" }), on: f.src === "other" },
          ]}
        />
        {head && (
          <FilterPills
            items={[
              { label: "Everyone's tasks", href: href({ by: "", person: "" }), on: !f.given },
              { label: "Given by me", count: f.byWhen.filter((t) => t.assigned_by === me.id).length, href: href({ by: "me", person: "" }), on: f.given },
            ]}
          />
        )}
        {extra}
        {f.doers.length > 1 && (
          <LinkSelect
            label="Person"
            value={f.person}
            options={[
              { value: "", label: "All people", href: href({ person: "" }) },
              ...f.doers.map(([id, name]) => ({ value: id, label: `${name} · ${f.byGiver.filter((t) => t.assignee_id === id && t.status !== "done").length} open`, href: href({ person: id }) })),
            ]}
          />
        )}
        {active.length > 1 && (
          <LinkSelect
            label="Brand"
            value={f.brand}
            options={[{ value: "", label: "All brands", href: href({ brand: "", kind: "" }) }, ...active.map((b) => ({ value: b.id, label: b.name, href: href({ brand: b.id, kind: "" }) }))]}
          />
        )}
        {f.kinds.length > 1 && (
          <LinkSelect
            label="Type"
            value={f.kind}
            options={[{ value: "", label: "All types", href: href({ kind: "" }) }, ...f.kinds.map((k) => ({ value: k, label: kindPlural(k), href: href({ kind: k }) }))]}
          />
        )}
        <LinkSelect
          label="Assigned"
          value={f.when}
          options={[
            { value: "", label: "Assigned any time", href: href({ when: "" }) },
            { value: "today", label: "Assigned today", href: href({ when: "today" }) },
            { value: "yesterday", label: "Assigned yesterday", href: href({ when: "yesterday" }) },
            { value: "week", label: "Assigned this week", href: href({ when: "week" }) },
            { value: "month", label: "Assigned this month", href: href({ when: "month" }) },
          ]}
        />
        {f.filtered && (
          <Link href={href({ brand: "", kind: "", src: "", person: "", by: "", q: "", when: "" })} scroll={false} className="px-2 text-[12.5px] text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </div>

      {showList && (
        <>
          <Counts
            items={f.lists.map((l) => ({
              label: l.title,
              value: l.list.length,
              tone: ["check", "late", "now"].includes(l.key) ? "red" : "",
              href: href({ show: l.key === f.firstKey ? "" : l.key }),
              active: l.key === pick.key,
            }))}
          />
          <div className="rise">
            {f.shown.length ? (
              <Section title={pick.title} count={pick.list.length} empty={pick.empty}>
                <ShowMore limit={f.q ? 200 : 25}>
                  {pick.list.map((t) => (pick.key === "check" && checkRow ? checkRow(t) : rowFor ? rowFor(t) : <TaskLine key={t.id} t={t} showAssignee={!member && !f.person} showBrand={!f.brand} showGiven />))}
                </ShowMore>
              </Section>
            ) : (
              <p className="card p-6 text-[13px] text-muted">{f.q ? `No task matches "${sp.q}".` : f.filtered ? "No tasks match these filters." : member ? "No tasks yet. When someone gives you work, it shows up here and on your phone." : "No tasks yet."}</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
