import "server-only";
// Amigo — the CRM's own assistant. No outside AI: it reads the words in a question (English or
// Hinglish), works out what is being asked, and answers straight from the CRM database with text,
// tables and charts. Nothing leaves the CRM.
import { db } from "@/lib/supabase/server";
import { CLOSED_STATUSES, OPEN_TASK, TASK_STATUSES, PROPOSAL_STAGES } from "@/lib/constants";
import { canSeeAllLeads, inGroupKind } from "@/lib/permissions";

const IST = "Asia/Kolkata";
const DAY = 864e5;
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const istTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null);
const nowMs = () => Date.now();

/** Who may use Amigo: admin / ops and the execution heads. */
export const canUseAmigo = (me) => me.role === "admin" || me.role === "ops" || inGroupKind(me, "execution");

/* ------------------------------ Data helpers ------------------------------ */

const TASK_SELECT = "id, title, kind, status, due_at, revision, done_at, updated_at, brand:brands(id, name), assignee:members!tasks_assignee_id_fkey(id, name)";
const like = (a, b) => String(a || "").toLowerCase().includes(String(b || "").toLowerCase().trim());
const isLate = (t, now) => OPEN_TASK.includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now;
const brief = (t) => ({
  id: t.id,
  title: t.title,
  kind: t.kind,
  brand: t.brand?.name || null,
  assignee: t.assignee?.name || null,
  status: TASK_STATUSES[t.status]?.label || t.status,
  due: istTime(t.due_at),
  revision: t.revision || 0,
  approved_at: t.status === "done" ? istTime(t.done_at) : undefined,
});

async function allTasks() {
  const { data } = await db().from("tasks").select(TASK_SELECT).limit(5000);
  return data || [];
}
async function people() {
  const { data } = await db().from("members").select("id, name, role, active, group_members(group:groups(name, kind))").eq("active", true).order("name");
  return (data || []).map((m) => ({ id: m.id, name: m.name, role: m.role, groups: (m.group_members || []).map((g) => g.group?.kind).filter(Boolean) }));
}
const noLeads = { error: "Leads, meetings and proposals are only visible to admin and ops." };

/* ------------------------------ Read tools ------------------------------ */

const READ = {
  async crm_snapshot(_, me) {
    const now = nowMs();
    const today = dayKey(now);
    const tasks = await allTasks();
    const byStatus = {};
    for (const t of tasks) byStatus[TASK_STATUSES[t.status]?.label || t.status] = (byStatus[TASK_STATUSES[t.status]?.label || t.status] || 0) + 1;
    const open = tasks.filter((t) => OPEN_TASK.includes(t.status));
    const perPerson = {};
    for (const t of open) {
      const n = t.assignee?.name || "Unassigned";
      perPerson[n] ||= { open: 0, late: 0 };
      perPerson[n].open += 1;
      if (isLate(t, now)) perPerson[n].late += 1;
    }
    const { data: brands } = await db().from("brands").select("stage");
    const out = {
      today,
      tasks: {
        by_status: byStatus,
        open: open.length,
        late: open.filter((t) => isLate(t, now)).length,
        due_today: open.filter((t) => t.due_at && dayKey(t.due_at) === today && !isLate(t, now)).length,
        waiting_for_review: tasks.filter((t) => ["completed", "client_rejected"].includes(t.status)).length,
        approved_last_7_days: tasks.filter((t) => t.status === "done" && t.done_at && now - new Date(t.done_at).getTime() < 7 * DAY).length,
        open_per_person: perPerson,
      },
      brands: { active: (brands || []).filter((b) => b.stage === "active").length, onboarding: (brands || []).filter((b) => b.stage !== "active").length },
    };
    if (canSeeAllLeads(me)) {
      const { data: leads } = await db().from("leads").select("status, assigned_to, created_at").limit(5000);
      const byStage = {};
      for (const l of leads || []) byStage[l.status] = (byStage[l.status] || 0) + 1;
      const { data: props } = await db().from("proposals").select("stage");
      const byProp = {};
      for (const p of props || []) byProp[PROPOSAL_STAGES[p.stage]?.label || p.stage] = (byProp[PROPOSAL_STAGES[p.stage]?.label || p.stage] || 0) + 1;
      const { data: meets } = await db().from("meetings").select("kind, starts_at").is("cancelled_at", null).gte("starts_at", new Date(now).toISOString()).lt("starts_at", new Date(now + 7 * DAY).toISOString());
      out.leads = {
        by_stage: byStage,
        open: (leads || []).filter((l) => !CLOSED_STATUSES.includes(l.status)).length,
        unassigned_open: (leads || []).filter((l) => !l.assigned_to && !CLOSED_STATUSES.includes(l.status)).length,
        new_last_7_days: (leads || []).filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY).length,
      };
      out.proposals_by_stage = byProp;
      out.meetings = { today: (meets || []).filter((m) => dayKey(m.starts_at) === today).length, next_7_days: (meets || []).length };
    }
    return out;
  },

  async team_workload({ person }) {
    const now = nowMs();
    const today = dayKey(now);
    const weekEnd = dayKey(now + 7 * DAY);
    const tasks = await allTasks();
    const map = new Map();
    for (const t of tasks) {
      const name = t.assignee?.name || "Unassigned";
      if (person && !like(name, person)) continue;
      const p = map.get(name) || { person: name, open: 0, late: 0, due_today: 0, due_this_week: 0, waiting_for_review: 0, with_client: 0, approved_last_7_days: 0, approved_last_30_days: 0, revisions: 0 };
      if (OPEN_TASK.includes(t.status)) {
        p.open += 1;
        if (isLate(t, now)) p.late += 1;
        else if (t.due_at && dayKey(t.due_at) === today) p.due_today += 1;
        if (t.due_at && dayKey(t.due_at) <= weekEnd && !isLate(t, now)) p.due_this_week += 1;
      }
      if (["completed", "client_rejected"].includes(t.status)) p.waiting_for_review += 1;
      if (t.status === "sent_to_client") p.with_client += 1;
      if (t.status === "done" && t.done_at) {
        const age = now - new Date(t.done_at).getTime();
        if (age < 7 * DAY) p.approved_last_7_days += 1;
        if (age < 30 * DAY) p.approved_last_30_days += 1;
      }
      p.revisions += t.revision || 0;
      map.set(name, p);
    }
    return { people: [...map.values()].sort((a, b) => b.open - a.open) };
  },

  async list_tasks({ filter = "open", person, brand, kind, approved_within_days, limit = 40 }) {
    const now = nowMs();
    const today = dayKey(now);
    const tomorrow = dayKey(now + DAY);
    const weekEnd = dayKey(now + 7 * DAY);
    let rows = await allTasks();
    const test = {
      open: (t) => OPEN_TASK.includes(t.status),
      late: (t) => isLate(t, now),
      due_today: (t) => OPEN_TASK.includes(t.status) && t.due_at && dayKey(t.due_at) === today && !isLate(t, now),
      due_tomorrow: (t) => OPEN_TASK.includes(t.status) && t.due_at && dayKey(t.due_at) === tomorrow,
      due_this_week: (t) => OPEN_TASK.includes(t.status) && t.due_at && dayKey(t.due_at) >= today && dayKey(t.due_at) <= weekEnd,
      to_check: (t) => ["completed", "client_rejected"].includes(t.status),
      with_client: (t) => t.status === "sent_to_client",
      approved: (t) => t.status === "done" && (!approved_within_days || (t.done_at && now - new Date(t.done_at).getTime() < approved_within_days * DAY)),
      all: () => true,
    }[filter] || (() => true);
    rows = rows.filter(test);
    if (person) rows = rows.filter((t) => like(t.assignee?.name, person));
    if (brand) rows = rows.filter((t) => like(t.brand?.name, brand));
    if (kind) rows = rows.filter((t) => t.kind === kind);
    rows.sort((a, b) => (a.due_at || "9").localeCompare(b.due_at || "9"));
    const cap = Math.min(Math.max(1, limit), 100);
    return { total: rows.length, shown: Math.min(cap, rows.length), tasks: rows.slice(0, cap).map(brief) };
  },

  async list_brands({ name }) {
    const now = nowMs();
    const [{ data: brands }, tasks] = await Promise.all([db().from("brands").select("id, name, stage, services, onboarded_at, mou_sent_at").order("name"), allTasks()]);
    return {
      brands: (brands || [])
        .filter((b) => !name || like(b.name, name))
        .map((b) => {
          const mine = tasks.filter((t) => t.brand?.id === b.id);
          return {
            id: b.id,
            name: b.name,
            stage: b.stage === "active" ? "active client" : b.stage === "mou_sent" ? "MOU sent, waiting for signature" : "MOU draft",
            services: (b.services || []).map((s) => s.name),
            client_since: b.onboarded_at ? dayKey(b.onboarded_at) : null,
            tasks: {
              open: mine.filter((t) => OPEN_TASK.includes(t.status)).length,
              late: mine.filter((t) => isLate(t, now)).length,
              to_check: mine.filter((t) => ["completed", "client_rejected"].includes(t.status)).length,
              with_client: mine.filter((t) => t.status === "sent_to_client").length,
              approved: mine.filter((t) => t.status === "done").length,
            },
          };
        }),
    };
  },

  async list_leads({ status, open_only, owner, created_within_days, untouched_for_days, search, limit = 40 }, me) {
    if (!canSeeAllLeads(me)) return noLeads;
    const now = nowMs();
    const [{ data }, team] = await Promise.all([
      db().from("leads").select("id, code, brand, first_name, last_name, phone, email, status, assigned_to, service, budget, source, created_at, updated_at").order("created_at", { ascending: false }).limit(5000),
      people(),
    ]);
    const name = Object.fromEntries(team.map((m) => [m.id, m.name]));
    let rows = data || [];
    if (status) rows = rows.filter((l) => l.status === status);
    if (open_only) rows = rows.filter((l) => !CLOSED_STATUSES.includes(l.status));
    if (owner) rows = owner.toLowerCase() === "unassigned" ? rows.filter((l) => !l.assigned_to) : rows.filter((l) => like(name[l.assigned_to], owner));
    if (created_within_days) rows = rows.filter((l) => now - new Date(l.created_at).getTime() < created_within_days * DAY);
    if (untouched_for_days) rows = rows.filter((l) => now - new Date(l.updated_at).getTime() >= untouched_for_days * DAY);
    if (search) rows = rows.filter((l) => [l.brand, l.first_name, l.last_name, l.phone, l.email, l.code].some((v) => like(v, search)));
    const cap = Math.min(Math.max(1, limit), 100);
    return {
      total: rows.length,
      shown: Math.min(cap, rows.length),
      leads: rows.slice(0, cap).map((l) => ({
        id: l.id,
        code: l.code,
        brand: l.brand || null,
        person: [l.first_name, l.last_name].filter(Boolean).join(" "),
        status: l.status,
        owner: name[l.assigned_to] || "Unassigned",
        service: l.service,
        budget: l.budget,
        source: l.source,
        created: dayKey(l.created_at),
        last_update: dayKey(l.updated_at),
      })),
    };
  },

  async leads_by_day({ days = 14 }, me) {
    if (!canSeeAllLeads(me)) return noLeads;
    const n = Math.min(Math.max(1, days), 90);
    const now = nowMs();
    const { data } = await db().from("leads").select("created_at").gte("created_at", new Date(now - n * DAY).toISOString()).limit(5000);
    const counts = {};
    for (const l of data || []) counts[dayKey(l.created_at)] = (counts[dayKey(l.created_at)] || 0) + 1;
    return { days: Array.from({ length: n }, (_, i) => dayKey(now - (n - 1 - i) * DAY)).map((d) => ({ day: d, leads: counts[d] || 0 })) };
  },

  async list_meetings({ from_days = 0, to_days = 7 }, me) {
    if (!canSeeAllLeads(me)) return noLeads;
    const now = nowMs();
    const start = new Date(`${dayKey(now + from_days * DAY)}T00:00:00+05:30`).toISOString();
    const end = new Date(`${dayKey(now + to_days * DAY)}T23:59:59+05:30`).toISOString();
    const { data } = await db()
      .from("meetings")
      .select("kind, starts_at, organizer:members(name), lead:leads(code, brand, first_name, last_name)")
      .is("cancelled_at", null)
      .gte("starts_at", start)
      .lte("starts_at", end)
      .order("starts_at")
      .limit(100);
    return {
      meetings: (data || []).map((m) => ({
        when: istTime(m.starts_at),
        kind: m.kind === "proposal" ? "Proposal meeting" : "Discovery call",
        lead: m.lead?.brand || [m.lead?.first_name, m.lead?.last_name].filter(Boolean).join(" "),
        code: m.lead?.code,
        organizer: m.organizer?.name,
      })),
    };
  },

  async list_proposals(_, me) {
    if (!canSeeAllLeads(me)) return noLeads;
    const { data } = await db().from("proposals").select("*, strategist:members!proposals_strategist_id_fkey(name), lead:leads(code, brand, first_name, last_name)").order("shared_at", { ascending: false }).limit(200);
    return {
      proposals: (data || []).map((p) => ({
        lead: p.lead?.brand || [p.lead?.first_name, p.lead?.last_name].filter(Boolean).join(" "),
        code: p.lead?.code,
        stage: PROPOSAL_STAGES[p.stage]?.label || p.stage,
        strategist: p.strategist?.name || "Not picked up",
        shared: p.shared_at ? dayKey(p.shared_at) : null,
        version: p.revision || 1,
      })),
    };
  },

  async list_people() {
    return { people: await people() };
  },

  async show_chart() {
    return { shown: true };
  },
};

export async function runReadTool(name, input, me) {
  const fn = READ[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  try {
    return await fn(input || {}, me);
  } catch (e) {
    return { error: e.message || "That lookup failed." };
  }
}


/* ------------------------------ Understanding a question ------------------------------ */

const norm = (q) =>
  ` ${String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
/** Any of these words (or word starts) in the question? */
const has = (q, words) => words.some((w) => q.includes(` ${w}`));

const W = {
  task: ["task", "kaam", "kam ", "work", "post", "reel", "story", "stories", "design", "video", "carousel", "deliver"],
  late: ["late", "overdue", "der ", "delay", "miss", "lat "],
  today: ["aaj", "aj ", "today", "abhi"],
  kal: ["kal "],
  tomorrow: ["tomorrow", "parso"],
  yesterday: ["yesterday"],
  week: ["hafte", "hafta", "week", "saptah", "7 din", "7 days"],
  month: ["mahine", "mahina", "month", "30 din"],
  pending: ["pending", "baaki", "baki", "bacha", "open", "remaining", "chal raha", "chalu"],
  who: ["kis ", "kiska", "kiske", "kaun", "employee", "team", "sab ", "sabka", "har ", "each", "per ", "workload", "busy", "load", "logo", "log "],
  check: ["check", "review", "approval", "dekhna", "verify"],
  client: ["client ke paas", "client pe", "client par", "with client", "client ko bhej", "sent to client"],
  done: ["approved", "approve ho", "done", "complete", "khatam", "finish", "ho gaya", "ho gye", "hue ", "hua "],
  lead: ["lead"],
  meeting: ["meeting", "call", "meet "],
  proposal: ["proposal", "deck", "brief", "pitch"],
  brand: ["brand", "clients", "client "],
  most: ["sabse", "most", "zyada", "jyada", "max", "top"],
  overview: ["overview", "summary", "report", "update", "kaisa", "kaise", "status", "haal", "kya chal", "dashboard"],
  unassigned: ["unassigned", "assign nahi", "bina owner", "no owner", "owner nahi"],
  chart: ["chart", "graph", "dikhao chart"],
};

const STATUS_WORDS = [
  ["won", "Won"],
  ["lost", "Lost"],
  ["negotiat", "Negotiation"],
  ["discovery", "Discovery Call"],
  ["follow", "Follow-up Scheduled"],
  ["dnp", "DNP"],
  ["hold", "On Hold"],
  ["no response", "No Response"],
  ["new lead", "New Lead"],
  ["touchbase", "First Call / Touchbase"],
];

function findPerson(q, team) {
  for (const p of team) {
    const full = p.name.toLowerCase();
    const first = full.split(" ")[0];
    if (q.includes(` ${full}`) || (first.length >= 3 && new RegExp(`\\s${first}(\\s|ka|ki|ke|ko|se)`).test(q))) return p;
  }
  return null;
}
function findBrand(q, brands) {
  for (const b of brands) {
    const name = b.name.toLowerCase();
    if (q.includes(` ${name}`)) return b;
    const words = name.split(/\s+/).filter((w) => w.length >= 4);
    if (words.length && words.every((w) => q.includes(` ${w}`))) return b;
  }
  return null;
}

/* ------------------------------ Answer pieces ------------------------------ */

const text = (t) => ({ type: "text", text: t });
const chart = (spec) => ({ type: "chart", spec });
const suggest = (items) => ({ type: "suggest", items });
const first = (n) => String(n || "").split(" ")[0];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function taskTable(tasks) {
  return {
    type: "table",
    columns: ["Task", "Brand", "Person", "Status", "Due"],
    rows: tasks.map((t) => ({ href: `/tasks/${t.id}`, cells: [t.title, t.brand || "—", first(t.assignee) || "—", t.status, t.due || "—"] })),
  };
}
function leadTable(leads) {
  return {
    type: "table",
    columns: ["Lead", "Status", "Owner", "Added", "Last update"],
    rows: leads.map((l) => ({ href: `/leads/${l.id}`, cells: [`${l.brand || l.person} (${l.code})`, l.status, first(l.owner), l.created, l.last_update] })),
  };
}

/* ------------------------------ Answers ------------------------------ */

async function workloadAnswer(me, { onlyChart } = {}) {
  const { people } = await READ.team_workload({}, me);
  const list = people.filter((p) => p.person !== "Unassigned" || p.open);
  if (!list.length) return [text("Abhi kisi ke paas koi task nahi hai.")];
  const busiest = [...list].sort((a, b) => b.open - a.open)[0];
  const totalOpen = list.reduce((n, p) => n + p.open, 0);
  const totalLate = list.reduce((n, p) => n + p.late, 0);
  return [
    text(`Team ke paas abhi **${plural(totalOpen, "task", "tasks")} pending** hain${totalLate ? `, jinme **${totalLate} late** hain` : ""}. Sabse zyada kaam **${first(busiest.person)}** ke paas hai (${busiest.open} open${busiest.late ? `, ${busiest.late} late` : ""}).`),
    chart({ type: "bar", title: "Pending work per person", labels: list.map((p) => first(p.person)), datasets: [{ label: "Open", values: list.map((p) => p.open) }, { label: "Late", values: list.map((p) => p.late) }] }),
    ...(onlyChart
      ? []
      : [
          {
            type: "table",
            columns: ["Person", "Open", "Late", "Due today", "To check", "Approved (7 days)"],
            rows: list.map((p) => ({ cells: [p.person, p.open, p.late, p.due_today, p.waiting_for_review, p.approved_last_7_days] })),
          },
        ]),
  ];
}

async function tasksAnswer(me, filter, intro, { person, brand, chartBy } = {}) {
  const r = await READ.list_tasks({ filter, person: person?.name, brand: brand?.name, limit: 30 }, me);
  if (!r.total) return [text(`${intro.none}`)];
  const out = [text(`${intro.some(r.total)}${r.total > r.shown ? ` Pehle ${r.shown} dikha raha hoon.` : ""}`)];
  if (chartBy && r.total > 1) {
    const counts = {};
    for (const t of r.tasks) counts[first(t.assignee) || "—"] = (counts[first(t.assignee) || "—"] || 0) + 1;
    out.push(chart({ type: "bar", title: intro.chartTitle || "Per person", labels: Object.keys(counts), datasets: [{ label: "Tasks", values: Object.values(counts) }] }));
  }
  out.push(taskTable(r.tasks));
  return out;
}

async function brandsRanked(me) {
  const { brands } = await READ.list_brands({}, me);
  const active = brands.filter((b) => b.stage === "active client").sort((a, b) => b.tasks.open - a.tasks.open);
  if (!active.length) return [text("Abhi koi active client nahi hai.")];
  const top = active[0];
  return [
    text(`Sabse zyada pending kaam **${top.name}** ka hai — ${top.tasks.open} open${top.tasks.late ? `, ${top.tasks.late} late` : ""}.`),
    chart({ type: "bar", title: "Pending work per brand", labels: active.map((b) => b.name), datasets: [{ label: "Open", values: active.map((b) => b.tasks.open) }, { label: "Late", values: active.map((b) => b.tasks.late) }] }),
    {
      type: "table",
      columns: ["Brand", "Open", "Late", "To check", "With client", "Approved"],
      rows: active.map((b) => ({ href: `/brands/${b.id}`, cells: [b.name, b.tasks.open, b.tasks.late, b.tasks.to_check, b.tasks.with_client, b.tasks.approved] })),
    },
  ];
}

async function brandAnswer(me, brand) {
  const { brands } = await READ.list_brands({ name: brand.name }, me);
  const b = brands.find((x) => x.id === brand.id) || brands[0];
  const open = await READ.list_tasks({ filter: "open", brand: brand.name, limit: 30 }, me);
  return [
    text(
      `**${b.name}** — ${b.stage}${b.services.length ? ` (${b.services.join(", ")})` : ""}${b.client_since ? `, client since ${b.client_since}` : ""}.\nKaam: **${b.tasks.open} open**, ${b.tasks.late} late, ${b.tasks.to_check} check karne ke liye, ${b.tasks.with_client} client ke paas, ${b.tasks.approved} approved.`,
    ),
    ...(open.total ? [taskTable(open.tasks)] : []),
    { type: "link", label: `Open ${b.name} workspace`, href: `/brands/${b.id}` },
  ];
}

async function leadsAnswer(me, q, team) {
  if (!canSeeAllLeads(me)) return [text("Leads ka data sirf admin aur ops dekh sakte hain.")];
  const owner = findPerson(q, team);
  const status = STATUS_WORDS.find(([w]) => q.includes(w))?.[1];
  if (has(q, W.unassigned)) {
    const r = await READ.list_leads({ owner: "unassigned", open_only: true, limit: 30 }, me);
    return r.total ? [text(`**${plural(r.total, "lead", "leads")}** ka koi owner nahi hai.`), leadTable(r.leads)] : [text("Saare open leads kisi na kisi ko assign hain ✓")];
  }
  let days = null;
  let label = "";
  if (has(q, W.today)) [days, label] = [1, "aaj"];
  else if (has(q, W.yesterday) || has(q, W.kal)) [days, label] = [2, "kal se ab tak"];
  else if (has(q, W.month)) [days, label] = [30, "pichhle 30 din mein"];
  else if (has(q, W.week)) [days, label] = [7, "is hafte (pichhle 7 din)"];
  const r = await READ.list_leads({ status, owner: owner?.name, created_within_days: days || undefined, open_only: !status && !days ? true : undefined, limit: 30 }, me);
  const out = [];
  const what = [status && `"${status}" status ke`, owner && `${first(owner.name)} ke`].filter(Boolean).join(", ");
  if (days) out.push(text(`${label[0].toUpperCase()}${label.slice(1)} **${plural(r.total, "naya lead", "naye leads")}** aaye${what ? ` (${what})` : ""}.`));
  else out.push(text(`${what ? `${what[0].toUpperCase()}${what.slice(1)} ` : "Abhi "}**${plural(r.total, "lead", "leads")}** ${status ? "hain" : "open hain"}.`));
  if (days && days > 1) {
    const { days: series } = await READ.leads_by_day({ days: Math.max(7, days) }, me);
    out.push(chart({ type: "bar", title: "New leads per day", labels: series.map((d) => d.day.slice(5)), datasets: [{ label: "Leads", values: series.map((d) => d.leads) }] }));
  } else if (!days && !status && !owner && r.total) {
    const snap = await READ.crm_snapshot({}, me);
    const stages = Object.entries(snap.leads.by_stage).filter(([s]) => !CLOSED_STATUSES.includes(s));
    if (stages.length > 1) out.push(chart({ type: "bar", title: "Open leads by stage", labels: stages.map(([s]) => s.split(" ")[0]), datasets: [{ label: "Leads", values: stages.map(([, n]) => n) }] }));
  }
  if (r.total) out.push(leadTable(r.leads));
  return out;
}

async function meetingsAnswer(me, q) {
  if (!canSeeAllLeads(me)) return [text("Meetings ka data sirf admin aur ops dekh sakte hain.")];
  let range = [0, 7];
  let label = "agle 7 din mein";
  if (has(q, W.today)) [range, label] = [[0, 0], "aaj"];
  else if (has(q, W.tomorrow) || has(q, W.kal)) [range, label] = [[1, 1], "kal"];
  else if (has(q, W.yesterday)) [range, label] = [[-1, -1], "kal (beeta hua)"];
  const { meetings } = await READ.list_meetings({ from_days: range[0], to_days: range[1] }, me);
  if (!meetings.length) return [text(`${label[0].toUpperCase()}${label.slice(1)} koi meeting nahi hai.`)];
  return [
    text(`${label[0].toUpperCase()}${label.slice(1)} **${plural(meetings.length, "meeting", "meetings")}** hain:`),
    { type: "table", columns: ["When", "Meeting", "Lead", "Who"], rows: meetings.map((m) => ({ cells: [m.when, m.kind, `${m.lead}${m.code ? ` (${m.code})` : ""}`, first(m.organizer) || "—"] })) },
  ];
}

async function proposalsAnswer(me) {
  if (!canSeeAllLeads(me)) return [text("Proposals ka data sirf admin aur ops dekh sakte hain.")];
  const { proposals } = await READ.list_proposals({}, me);
  if (!proposals.length) return [text("Abhi koi proposal nahi hai.")];
  const live = proposals.filter((p) => p.stage !== "Proposal ready");
  return [
    text(`**${plural(live.length, "proposal", "proposals")}** chal rahe hain, ${proposals.length - live.length} ready hain.`),
    { type: "table", columns: ["Lead", "Stage", "Strategist", "Shared"], rows: proposals.slice(0, 30).map((p) => ({ cells: [`${p.lead} (${p.code})`, p.stage, first(p.strategist), p.shared || "—"] })) },
  ];
}

async function overviewAnswer(me) {
  const s = await READ.crm_snapshot({}, me);
  const lines = [
    `**Kaam:** ${s.tasks.open} open, **${s.tasks.late} late**, ${s.tasks.due_today} aaj due, ${s.tasks.waiting_for_review} check karne ke liye, ${s.tasks.approved_last_7_days} is hafte approved.`,
    `**Clients:** ${s.brands.active} active${s.brands.onboarding ? `, ${s.brands.onboarding} onboarding mein` : ""}.`,
  ];
  if (s.leads) lines.push(`**Leads:** ${s.leads.open} open, ${s.leads.new_last_7_days} is hafte naye, ${s.leads.unassigned_open} bina owner ke.`);
  if (s.meetings) lines.push(`**Meetings:** ${s.meetings.today} aaj, ${s.meetings.next_7_days} agle 7 din mein.`);
  const per = Object.entries(s.tasks.open_per_person);
  return [
    text(`Aaj ka haal (${s.today}):\n\n${lines.map((l) => `- ${l}`).join("\n")}`),
    ...(per.length ? [chart({ type: "bar", title: "Open tasks per person", labels: per.map(([n]) => first(n)), datasets: [{ label: "Open", values: per.map(([, v]) => v.open) }, { label: "Late", values: per.map(([, v]) => v.late) }] })] : []),
  ];
}

const HELP = [
  "Aaj ka overview do",
  "Kis employee ka kitna kaam pending hai?",
  "Aaj kitne tasks pending hain?",
  "Kaunse tasks late hain?",
  "Kya check karna baaki hai?",
  "Is hafte kitne leads aaye?",
  "Kis brand ka sabse zyada kaam pending hai?",
  "Kal kis kis ki meeting hai?",
];

/** "1 task … hain" → "1 task … hai" */
const grammar = (blocks) =>
  blocks.map((b) => (b.type === "text" ? { ...b, text: b.text.replace(/(\b1 (?:task|lead|naya lead|meeting|proposal)\b[^.:\n]*?)\bhain\b/g, "$1hai") } : b));

/** Works out what the question is about and answers it from the CRM. Returns display blocks. */
export async function answer(question, me) {
  return grammar(await understand(question, me));
}

async function understand(question, me) {
  const q = norm(question);
  const [team, { data: brandRows }] = await Promise.all([people(), db().from("brands").select("id, name")]);
  const person = findPerson(q, team);
  const brand = findBrand(q, brandRows || []);
  const p = person ? first(person.name) : "";

  if (has(q, W.meeting)) return meetingsAnswer(me, q);
  if (has(q, W.proposal)) return proposalsAnswer(me);
  if (has(q, W.lead)) return leadsAnswer(me, q, team);
  if (brand && !person) return brandAnswer(me, brand);

  if (person) {
    if (has(q, W.late)) return tasksAnswer(me, "late", { none: `${p} ka koi task late nahi hai ✓`, some: (n) => `${p} ke **${plural(n, "task", "tasks")} late** hain:` }, { person });
    if (has(q, W.check)) return tasksAnswer(me, "to_check", { none: `${p} ka kuch check karna baaki nahi hai.`, some: (n) => `${p} ke **${n}** tasks check karne hain:` }, { person });
    if (has(q, W.done)) return tasksAnswer(me, "approved", { none: `${p} ka abhi koi task approved nahi hai.`, some: (n) => `${p} ke **${plural(n, "task", "tasks")} approved** hue hain:` }, { person });
    if (has(q, W.today)) return tasksAnswer(me, "due_today", { none: `${p} ka aaj koi task due nahi hai.`, some: (n) => `${p} ke aaj **${plural(n, "task", "tasks")} due** hain:` }, { person });
    const w = (await READ.team_workload({ person: person.name }, me)).people[0];
    const tasks = await tasksAnswer(me, "open", { none: `${p} ke paas abhi koi pending task nahi hai ✓`, some: () => "" }, { person });
    if (!w) return tasks;
    return [
      text(`**${person.name}** ke paas **${plural(w.open, "task", "tasks")} pending** hain — ${w.late} late, ${w.due_today} aaj due, ${w.due_this_week} is hafte due. ${w.waiting_for_review} check ke liye gaye hain, aur pichhle 7 din mein ${w.approved_last_7_days} approved hue.`),
      ...tasks.filter((b) => b.type !== "text"),
    ];
  }

  if (has(q, W.brand) && (has(q, W.most) || has(q, W.pending) || has(q, W.task))) return brandsRanked(me);
  if (has(q, W.late)) return tasksAnswer(me, "late", { none: "Koi bhi task late nahi hai ✓", some: (n) => `**${plural(n, "task", "tasks")} late** hain:`, chartTitle: "Late tasks per person" }, { chartBy: true });
  if (has(q, W.check)) return tasksAnswer(me, "to_check", { none: "Abhi kuch check karna baaki nahi hai ✓", some: (n) => `**${plural(n, "task", "tasks")}** check karne baaki hain:` });
  if (W.client.some((w) => q.includes(w))) return tasksAnswer(me, "with_client", { none: "Abhi client ke paas koi task nahi hai.", some: (n) => `**${plural(n, "task", "tasks")}** client ke paas hain:` });
  if (has(q, W.done)) {
    const days = has(q, W.today) ? 1 : has(q, W.month) ? 30 : 7;
    const r = await READ.list_tasks({ filter: "approved", approved_within_days: days, limit: 30 }, me);
    const when = days === 1 ? "Aaj" : days === 30 ? "Pichhle 30 din mein" : "Is hafte";
    return r.total ? [text(`${when} **${plural(r.total, "task", "tasks")} approved** hue:`), taskTable(r.tasks)] : [text(`${when} koi task approved nahi hua.`)];
  }
  if (has(q, W.who) && (has(q, W.task) || has(q, W.pending))) return workloadAnswer(me);
  if (has(q, W.today) && (has(q, W.task) || has(q, W.pending))) {
    const due = await tasksAnswer(me, "due_today", { none: "Aaj koi task due nahi hai.", some: (n) => `Aaj **${plural(n, "task", "tasks")} due** hain:` });
    const late = await READ.list_tasks({ filter: "late", limit: 30 }, me);
    return [...due, ...(late.total ? [text(`Iske alawa **${plural(late.total, "task", "tasks")} pehle se late** hain:`), taskTable(late.tasks)] : [])];
  }
  if ((has(q, W.tomorrow) || has(q, W.kal)) && (has(q, W.task) || has(q, W.pending)))
    return tasksAnswer(me, "due_tomorrow", { none: "Kal koi task due nahi hai.", some: (n) => `Kal **${plural(n, "task", "tasks")} due** hain:` });
  if (has(q, W.week) && (has(q, W.task) || has(q, W.pending)))
    return tasksAnswer(me, "due_this_week", { none: "Is hafte koi task due nahi hai.", some: (n) => `Is hafte **${plural(n, "task", "tasks")} due** hain:` }, { chartBy: true });
  if (has(q, W.pending) || has(q, W.task) || has(q, W.chart)) return workloadAnswer(me);
  if (has(q, W.overview) || has(q, W.today)) return overviewAnswer(me);

  return [text("Yeh main abhi samajh nahi paaya 🙏 Main in cheezon mein madad kar sakta hoon — neeche se kuch poocho, ya kisi employee / brand ka naam likh ke poocho (jaise \"Riya ka kaam\" ya \"Shadowe ka status\")."), suggest(HELP)];
}

export const AMIGO_SUGGESTIONS = HELP;
