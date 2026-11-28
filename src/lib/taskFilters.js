// The Tasks list's filters and tabs, shared by the Tasks page and the dashboards (pure — no database).
//   sp: the page's search params — q, brand, kind, when, by=me, person, src, show
import { OPEN_TASK, byPriority, fromCalendar } from "@/lib/constants";

const DAY = 864e5;
const istDay = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * all    the tasks this person may see on this screen
 * active the active brands ({ id, name })
 * lead   a team lead (their "To check" is work waiting on them)
 */
export function filterTasks({ all, sp = {}, me, active = [], lead = false, member = false }) {
  const now = Date.now();
  const brand = active.find((b) => b.id === sp.brand)?.id || "";
  const byBrand = brand ? all.filter((t) => t.brand_id === brand) : all;
  const kinds = [...new Set(byBrand.map((t) => t.kind))];
  const kind = kinds.includes(sp.kind) ? sp.kind : "";
  const byKind = kind ? byBrand.filter((t) => t.kind === kind) : byBrand;
  // When it was given (India time)
  const todayKey = istDay(now);
  const WHEN = {
    today: (k) => k === todayKey,
    yesterday: (k) => k === istDay(now - DAY),
    week: (k) => k >= istDay(now - 6 * DAY),
    month: (k) => k >= istDay(now - 29 * DAY),
  };
  const when = WHEN[sp.when] ? sp.when : "";
  const byWhen = when ? byKind.filter((t) => t.created_at && WHEN[when](istDay(new Date(t.created_at).getTime()))) : byKind;
  // Only what I gave out / one person's work
  const given = sp.by === "me";
  const byGiver = given ? byWhen.filter((t) => t.assigned_by === me.id) : byWhen;
  const doers = [...new Map(byGiver.filter((t) => t.assignee).map((t) => [t.assignee_id, t.assignee.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const person = doers.some(([id]) => id === sp.person) ? sp.person : "";
  const byPerson = person ? byGiver.filter((t) => t.assignee_id === person) : byGiver;
  // Content-calendar work vs everything else
  const src = ["calendar", "other"].includes(sp.src) ? sp.src : "";
  const bySrc = src ? byPerson.filter((t) => (src === "calendar") === fromCalendar(t)) : byPerson;
  // Search: every word must match the task name, brand, person or type
  const q = String(sp.q || "")
    .trim()
    .toLowerCase()
    .slice(0, 80);
  const words = q.split(/\s+/).filter(Boolean);
  const hay = (t) => [t.title, t.brand?.name, t.assignee?.name, t.kind].join(" ").toLowerCase();
  const shown = words.length ? bySrc.filter((t) => words.every((w) => hay(t).includes(w))) : bySrc;

  const isLate = (t) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;
  const finished = (t) => ["completed", "client_rejected"].includes(t.status);
  const toCheck = (lead ? shown.filter((t) => t.with_lead && (t.lead_ids || []).includes(me.id)) : shown.filter((t) => finished(t) && !t.with_lead)).sort(byPriority);
  // Heads: still with the team lead. Team leads: checked by them, now with the manager.
  const withLead = lead ? shown.filter((t) => finished(t) && !t.with_lead) : shown.filter((t) => t.with_lead);
  const dayOf = (iso) => istDay(new Date(iso).getTime());
  // Someone doing the work: what to do now, what's next, what's with others, what's done
  const memberLists = member && [
    {
      key: "now",
      title: "Do now",
      list: shown.filter((t) => OPEN_TASK.includes(t.status) && (t.status === "revision" || isLate(t) || (t.due_at && dayOf(t.due_at) <= todayKey))).sort(byPriority),
      empty: "Nothing due today. Check Coming up.",
    },
    {
      key: "next",
      title: "Coming up",
      list: shown.filter((t) => OPEN_TASK.includes(t.status) && t.status !== "revision" && !isLate(t) && !(t.due_at && dayOf(t.due_at) <= todayKey)).sort((a, b) => (a.due_at || "9").localeCompare(b.due_at || "9")),
      empty: "Nothing else coming up.",
    },
    { key: "waiting", title: "Waiting on others", list: shown.filter((t) => ["completed", "ready", "sent_to_client", "client_rejected"].includes(t.status)), empty: "Nothing waiting on your manager or the client." },
    { key: "hold", title: "On hold", list: shown.filter((t) => t.status === "on_hold"), optional: true },
    { key: "done", title: "Completed", list: shown.filter((t) => t.status === "done").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")), empty: "Nothing approved yet." },
  ];
  const lists = (memberLists || [
    { key: "check", title: "To check", list: toCheck, empty: "Nothing waiting for your check." },
    { key: "late", title: "Late", list: shown.filter(isLate).sort(byPriority), empty: "Nothing late." },
    { key: "progress", title: "In progress", list: shown.filter((t) => OPEN_TASK.includes(t.status) && !isLate(t)).sort(byPriority), empty: "Nothing in progress." },
    { key: "lead", title: lead ? "With manager" : "With team lead", list: withLead, empty: lead ? "Nothing waiting on the manager." : "Nothing with the team leads." },
    { key: "ready", title: "Ready for client", list: shown.filter((t) => t.status === "ready"), optional: true },
    { key: "hold", title: "On hold", list: shown.filter((t) => t.status === "on_hold"), optional: true },
    { key: "client", title: "With client", list: shown.filter((t) => t.status === "sent_to_client"), optional: true },
    { key: "done", title: "Completed", list: shown.filter((t) => t.status === "done").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")), empty: "Nothing completed yet." },
  ]).filter((l) => !l.optional || l.list.length);
  // Opens on the first list that has something unless one was picked
  const firstKey = (lists.find((l) => l.list.length) || lists[0]).key;
  const pick = lists.find((l) => l.key === sp.show) || lists.find((l) => l.key === firstKey);
  const filtered = Boolean(brand || kind || src || person || given || q || when);
  return { brand, kind, kinds, when, given, doers, person, src, q, byKind, byWhen, byGiver, byPerson, shown, lists, firstKey, pick, filtered };
}

/** A link to the same screen with some filters changed (empty values drop out). keep: params to carry (view, who). */
export function filterHref(base, f, sp, keep = {}, o = {}) {
  const qs = new URLSearchParams({
    ...keep,
    ...(f.brand && { brand: f.brand }),
    ...(f.kind && { kind: f.kind }),
    ...(f.src && { src: f.src }),
    ...(f.person && { person: f.person }),
    ...(f.given && { by: "me" }),
    ...(f.q && { q: sp.q }),
    ...(f.when && { when: f.when }),
    ...(sp.show && { show: sp.show }),
    ...o,
  });
  for (const [k, v] of [...qs]) if (!v) qs.delete(k);
  const str = qs.toString();
  return str ? `${base}?${str}` : base;
}
