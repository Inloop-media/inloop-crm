// The tasks desk: search + filters (brand, person, type, assigned on, given by me), the number cards, and
// every group of tasks as a fold-open table. Used on the Tasks page and on the dashboards (server component).
import Link from "next/link";
import Icon from "@/components/Icon";
import { FilterPills } from "@/components/Desk";
import { Counts } from "@/components/Home";
import LinkSelect from "@/components/LinkSelect";
import TaskTable from "@/components/TaskTable";
import { NextStep } from "@/components/MyWork";
import TaskSearch from "@/components/TaskSearch";
import { fromCalendar, kindPlural } from "@/lib/constants";
import { filterHref, filterTasks } from "@/lib/taskFilters";

/**
 * base       the page's path ("/tasks" or "/")
 * keep       params this page keeps when filters change (e.g. { view: "board" }, { who: "all" })
 * extra      more controls for the filter row (e.g. My team / Everyone)
 * showList   false on the board view: just the filters
 * checkRow   (task) => a richer row for the To check tab (e.g. with Approve / Send back on the dashboard)
 * member     the person doing the work: Do now / Coming up / Waiting / Completed, with Start / Upload on each row
 *
 * The number cards on top pick one group (click again for all); below, every group is a fold-open table.
 */
// The cards on top: the four groups that matter most
const CARDS = ["check", "late", "progress", "lead", "now", "next", "waiting", "done"];

export default function TaskDesk({ me, sp = {}, base = "/tasks", all, active = [], head = false, lead = false, member = false, keep = {}, extra = null, showList = true, checkRow = null }) {
  const f = filterTasks({ all, sp, me, active, lead, member });
  const href = (o) => filterHref(base, f, sp, keep, o);
  const { pick } = f;
  const controls = (
    <>
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
    </>
  );
  return (
    <>
      <div className="card rise mb-4 flex flex-wrap items-center gap-2 p-2.5">
        <TaskSearch />
        <div className="hidden md:contents">{controls}</div>
        {/* Phones: the filters fold under one button */}
        <details className="group/f w-full md:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-1 py-1 text-[12.5px] font-medium text-muted [&::-webkit-details-marker]:hidden">
            <Icon name="chevron" size={13} className="-rotate-90 transition group-open/f:rotate-0" /> Filters{f.filtered ? " · on" : ""}
          </summary>
          <div className="flex flex-wrap gap-2 pt-2">{controls}</div>
        </details>
        {f.filtered && (
          <Link href={href({ brand: "", kind: "", src: "", person: "", by: "", q: "", when: "" })} scroll={false} className="px-2 text-[12.5px] text-muted hover:text-ink">
            Clear
          </Link>
        )}
      </div>

      {showList && (
        <>
          <Counts
            items={f.lists
              .filter((l) => CARDS.includes(l.key))
              .map((l) => ({
                label: l.title,
                value: l.list.length,
                tone: ["check", "late", "now"].includes(l.key) ? "red" : "",
                href: href({ show: sp.show === l.key ? "" : l.key }),
                active: sp.show === l.key,
              }))}
          />
          {sp.show && f.lists.some((l) => l.key === sp.show) && (
            <Link href={href({ show: "" })} scroll={false} className="rise mb-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">
              ← Show every group
            </Link>
          )}
          <div className="rise">
            {f.shown.length || !f.filtered ? (
              <TaskTable
                groups={sp.show && f.lists.some((l) => l.key === sp.show) ? [pick] : f.lists}
                open={sp.show ? [sp.show] : member ? ["now", "next"] : ["check", "late", "progress"]}
                mine={member}
                showBrand={!f.brand}
                row={checkRow ? (t, key) => key === "check" && checkRow(t) : null}
                action={member ? (t) => <NextStep t={t} /> : null}
                limit={f.q ? 200 : 8}
              />
            ) : (
              <p className="card p-6 text-[13px] text-muted">{f.q ? `No task matches "${sp.q}".` : "No tasks match these filters."}</p>
            )}
          </div>
        </>
      )}
    </>
  );
}
