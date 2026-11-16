import "server-only";
// Amigo — the CRM's own assistant. No outside AI: it reads the words in a question (English or
// Hinglish), works out what is being asked, and answers straight from the CRM database with text,
// tables and charts. Nothing leaves the CRM.
import { db } from "@/lib/supabase/server";
import { CLOSED_STATUSES, OPEN_TASK, TASK_STATUSES, PROPOSAL_STAGES, kindPlural } from "@/lib/constants";
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
  task: ["task", "due", "deadline", "kaam", "kam ", "work", "post", "reel", "story", "stories", "design", "video", "carousel", "deliver"],
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
  done: ["approved", "approve", "approve ho", "done", "complete", "khatam", "finish", "ho gaya", "ho gye", "hue ", "hua "],
  lead: ["lead"],
  meeting: ["meeting", "call", "meet "],
  proposal: ["proposal", "deck", "brief", "pitch"],
  brand: ["brand", "clients", "client "],
  most: ["sabse", "most", "zyada", "jyada", "max", "top"],
  overview: ["overview", "summary", "report", "update", "kaisa", "kaise", "status", "haal", "kya chal", "dashboard"],
  unassigned: ["unassigned", "assign nahi", "bina owner", "no owner", "owner nahi"],
  chart: ["chart", "graph", "dikhao chart"],
  count: ["how many", "how much", "kitne", "kitna", "kitni", "count", "total", "number", "kaun kaun", "kon kon", "list", "all ", "sab ", "saare", "sare ", "till now", "ab tak", "abtak", "so far"],
  onboard: ["onboard", "signed", "sign ", "joined", "join ", "naye client", "new client", "client bane", "mou"],
  people: ["team", "employee", "staff", "member", "log ", "logo", "people", "designer", "editor", "developer", "strategist", "sales person", "salesperson", "executive", "head"],
  perform: ["performer", "best", "most work done", "kisne kiya", "kisne kaam", "productive", "top ", "leaderboard", "ranking"],
  revision: ["revision", "fix", "galti", "changes", "redo", "sent back"],
  source: ["source", "kahan se", "kaha se", "where from", "channel", "website se", "instagram", "referral"],
  least: ["free", "kam kaam", "sabse kam", "least", "khali", "khaali", "less work", "available"],
  stale: ["update nahi", "no update", "stale", "kaafi din", "bahut din", "follow up nahi", "followup nahi", "untouched", "pade hue", "pada hua", "not updated"],
  onboarding: ["onboarding", "mou", "signature", "sign nahi"],
  conversion: ["conversion", "convert", "win rate", "winrate", "success rate", "close rate", "kitne won", "kitne lost"],
};
const KIND_WORDS = [
  ["reel", "reel"],
  ["carousel", "carousel"],
  ["stor", "story"],
  ["video", "video"],
  ["post", "post"],
  ["design", "design"],
  ["website", "website"],
];
const ROLE_WORDS = [
  ["design", "design", "Designer"],
  ["editor", "video", "Video editor"],
  ["video", "video", "Video editor"],
  ["develop", "development", "Developer"],
  ["sales", "sales", "Sales"],
  ["strateg", "strategy", "Strategist"],
  ["head", "execution", "Execution head"],
];

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
  if (!list.length) return [text("Nobody has any tasks right now.")];
  const busiest = [...list].sort((a, b) => b.open - a.open)[0];
  const totalOpen = list.reduce((n, p) => n + p.open, 0);
  const totalLate = list.reduce((n, p) => n + p.late, 0);
  return [
    text(`The team has **${plural(totalOpen, "task", "tasks")} pending**${totalLate ? `, of which **${totalLate} ${totalLate === 1 ? "is" : "are"} late**` : ""}. **${first(busiest.person)}** has the most (${busiest.open} open${busiest.late ? `, ${busiest.late} late` : ""}).`),
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
  const out = [text(`${intro.some(r.total)}${r.total > r.shown ? ` Showing the first ${r.shown}.` : ""}`)];
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
  if (!active.length) return [text("There are no active clients yet.")];
  const top = active[0];
  return [
    text(`**${top.name}** has the most pending work — ${top.tasks.open} open${top.tasks.late ? `, ${top.tasks.late} late` : ""}.`),
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
      `**${b.name}** — ${b.stage}${b.services.length ? ` (${b.services.join(", ")})` : ""}${b.client_since ? `, client since ${b.client_since}` : ""}.\nWork: **${b.tasks.open} open**, ${b.tasks.late} late, ${b.tasks.to_check} to check, ${b.tasks.with_client} with the client, ${b.tasks.approved} approved.`,
    ),
    ...(open.total ? [taskTable(open.tasks)] : []),
    { type: "link", label: `Open ${b.name} workspace`, href: `/brands/${b.id}` },
  ];
}

async function leadsAnswer(me, q, team) {
  if (!canSeeAllLeads(me)) return [text("Only admin and ops can see leads.")];
  const owner = findPerson(q, team);
  const status = STATUS_WORDS.find(([w]) => q.includes(w))?.[1];
  if (has(q, W.unassigned)) {
    const r = await READ.list_leads({ owner: "unassigned", open_only: true, limit: 30 }, me);
    return r.total ? [text(`**${plural(r.total, "lead has", "leads have")}** no owner yet.`), leadTable(r.leads)] : [text("Every open lead has an owner ✓")];
  }
  if (has(q, W.count) && !status && !owner && !has(q, W.today) && !has(q, W.week) && !has(q, W.month) && !has(q, W.kal) && !has(q, W.yesterday) && !has(q, W.pending)) {
    const rows = await allLeadRows();
    const won = rows.filter((l) => l.status === "Won").length;
    const lost = rows.filter((l) => l.status === "Lost").length;
    const open = rows.filter((l) => !CLOSED_STATUSES.includes(l.status)).length;
    const snap = await READ.crm_snapshot({}, me);
    const stages = Object.entries(snap.leads?.by_stage || {});
    return [
      text(`**${plural(rows.length, "lead", "leads")}** so far — **${open} open**, ${won} won, ${lost} lost, ${rows.length - won - lost - open} on hold / no response.`),
      ...(stages.length > 1 ? [chart({ type: "bar", title: "Leads by stage", labels: stages.map(([st]) => st.split(" ")[0]), datasets: [{ label: "Leads", values: stages.map(([, n]) => n) }] })] : []),
    ];
  }
  let days = null;
  let label = "";
  if (has(q, W.today)) [days, label] = [1, "today"];
  else if (has(q, W.yesterday) || has(q, W.kal)) [days, label] = [2, "since yesterday"];
  else if (has(q, W.month)) [days, label] = [30, "over the last 30 days"];
  else if (has(q, W.week)) [days, label] = [7, "over the last 7 days"];
  const r = await READ.list_leads({ status, owner: owner?.name, created_within_days: days || undefined, open_only: !status && !days ? true : undefined, limit: 30 }, me);
  const out = [];
  const what = [status && `status "${status}"`, owner && `owned by ${first(owner.name)}`].filter(Boolean).join(", ");
  if (days) out.push(text(`**${plural(r.total, "new lead", "new leads")}** came in ${label}${what ? ` (${what})` : ""}.`));
  else out.push(text(`There ${r.total === 1 ? "is" : "are"} **${plural(r.total, status ? "lead" : "open lead", status ? "leads" : "open leads")}**${what ? ` (${what})` : ""}.`));
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
  if (!canSeeAllLeads(me)) return [text("Only admin and ops can see meetings.")];
  let range = [0, 7];
  let label = "in the next 7 days";
  if (has(q, W.today)) [range, label] = [[0, 0], "today"];
  else if (has(q, W.tomorrow) || has(q, W.kal)) [range, label] = [[1, 1], "tomorrow"];
  else if (has(q, W.yesterday)) [range, label] = [[-1, -1], "yesterday"];
  const { meetings } = await READ.list_meetings({ from_days: range[0], to_days: range[1] }, me);
  if (!meetings.length) return [text(`No meetings ${label}.`)];
  return [
    text(`**${plural(meetings.length, "meeting", "meetings")}** ${label}:`),
    { type: "table", columns: ["When", "Meeting", "Lead", "Who"], rows: meetings.map((m) => ({ cells: [m.when, m.kind, `${m.lead}${m.code ? ` (${m.code})` : ""}`, first(m.organizer) || "—"] })) },
  ];
}

async function proposalsAnswer(me) {
  if (!canSeeAllLeads(me)) return [text("Only admin and ops can see proposals.")];
  const { proposals } = await READ.list_proposals({}, me);
  if (!proposals.length) return [text("There are no proposals yet.")];
  const live = proposals.filter((p) => p.stage !== "Proposal ready");
  return [
    text(`**${plural(live.length, "proposal", "proposals")} in progress**, ${proposals.length - live.length} ready.`),
    { type: "table", columns: ["Lead", "Stage", "Strategist", "Shared"], rows: proposals.slice(0, 30).map((p) => ({ cells: [`${p.lead} (${p.code})`, p.stage, first(p.strategist), p.shared || "—"] })) },
  ];
}

async function overviewAnswer(me) {
  const s = await READ.crm_snapshot({}, me);
  const lines = [
    `**Tasks:** ${s.tasks.open} open, **${s.tasks.late} late**, ${s.tasks.due_today} due today, ${s.tasks.waiting_for_review} to check, ${s.tasks.approved_last_7_days} approved this week.`,
    `**Clients:** ${s.brands.active} active${s.brands.onboarding ? `, ${s.brands.onboarding} onboarding` : ""}.`,
  ];
  if (s.leads) lines.push(`**Leads:** ${s.leads.open} open, ${s.leads.new_last_7_days} new this week, ${s.leads.unassigned_open} without an owner.`);
  if (s.meetings) lines.push(`**Meetings:** ${s.meetings.today} today, ${s.meetings.next_7_days} in the next 7 days.`);
  const per = Object.entries(s.tasks.open_per_person);
  return [
    text(`Here's where things stand today (${s.today}):\n\n${lines.map((l) => `- ${l}`).join("\n")}`),
    ...(per.length ? [chart({ type: "bar", title: "Open tasks per person", labels: per.map(([n]) => first(n)), datasets: [{ label: "Open", values: per.map(([, v]) => v.open) }, { label: "Late", values: per.map(([, v]) => v.late) }] })] : []),
  ];
}


/* ------------------------------ More answers ------------------------------ */

const monthLabel = (k) => new Date(`${k}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
const lastMonths = (n) => {
  const d = new Date();
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
};

async function brandsCount(me, q) {
  const { brands } = await READ.list_brands({}, me);
  const active = brands.filter((b) => b.stage === "active client").sort((a, b) => (a.client_since || "").localeCompare(b.client_since || ""));
  const onboarding = brands.filter((b) => b.stage !== "active client");
  if (!brands.length) return [text("No brands have been onboarded yet.")];
  const now = nowMs();
  let within = null;
  if (has(q, W.today)) within = 1;
  else if (has(q, W.week)) within = 7;
  else if (has(q, W.month)) within = 30;
  const recent = within ? active.filter((b) => b.client_since && now - new Date(b.client_since).getTime() < within * DAY) : null;
  const months = lastMonths(6);
  const perMonth = months.map((m) => active.filter((b) => (b.client_since || "").startsWith(m)).length);
  return [
    text(
      within
        ? `**${plural(recent.length, "brand was", "brands were")} onboarded** ${within === 1 ? "today" : within === 7 ? "in the last 7 days" : "in the last 30 days"}. You have **${plural(active.length, "active client", "active clients")}** in total${onboarding.length ? `, aur ${onboarding.length} onboarding mein (MOU pending)` : ""}.`
        : `**${plural(active.length, "brand has", "brands have")} been onboarded** so far (active clients)${onboarding.length ? `, and **${onboarding.length}** ${onboarding.length === 1 ? "is" : "are"} still onboarding (MOU pending)` : ""}.`,
    ),
    ...(active.length > 1 ? [chart({ type: "bar", title: "Brands onboarded per month", labels: months.map(monthLabel), datasets: [{ label: "Onboarded", values: perMonth }] })] : []),
    {
      type: "table",
      columns: ["Brand", "Stage", "Client since", "Open tasks", "Approved"],
      rows: [...(recent || active), ...(within ? [] : onboarding)].map((b) => ({ href: `/brands/${b.id}`, cells: [b.name, b.stage, b.client_since || "—", b.tasks.open, b.tasks.approved] })),
    },
  ];
}

async function teamAnswer(me, q) {
  const [team, { people: work }] = await Promise.all([people(), READ.team_workload({}, me)]);
  const role = ROLE_WORDS.find(([w]) => q.includes(w));
  const LABEL = Object.fromEntries(ROLE_WORDS.map(([, k, l]) => [k, l]));
  const list = role ? team.filter((m) => m.groups.includes(role[1])) : team;
  const open = Object.fromEntries(work.map((w) => [w.person, w.open]));
  const what = role ? `${role[2]}s` : "team members";
  return [
    text(`There ${list.length === 1 ? "is" : "are"} **${plural(list.length, role ? role[2] : "team member", what)}**${role ? "" : " (active)"}.`),
    {
      type: "table",
      columns: ["Name", "Role", "Works as", "Open tasks"],
      rows: list.map((m) => ({ cells: [m.name, m.role === "member" ? "Member" : m.role[0].toUpperCase() + m.role.slice(1), [...new Set(m.groups.map((g) => LABEL[g] || g))].join(", ") || "—", open[m.name] || 0] })),
    },
  ];
}

async function performersAnswer(me, q) {
  const days = has(q, W.week) ? 7 : has(q, W.today) ? 1 : 30;
  const r = await READ.list_tasks({ filter: "approved", approved_within_days: days, limit: 100 }, me);
  const by = {};
  for (const t of r.tasks) by[t.assignee || "—"] = (by[t.assignee || "—"] || 0) + 1;
  const ranked = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const when = days === 1 ? "today" : days === 7 ? "this week" : "in the last 30 days";
  if (!ranked.length) return [text(`No tasks have been approved ${when} yet.`)];
  return [
    text(`**${ranked[0][0]}** did the most work ${when} — **${plural(ranked[0][1], "task", "tasks")} approved**.`),
    chart({ type: "bar", title: `Approved tasks (${when})`, labels: ranked.map(([n]) => first(n)), datasets: [{ label: "Approved", values: ranked.map(([, n]) => n) }] }),
  ];
}

async function revisionsAnswer(me) {
  const r = await READ.list_tasks({ filter: "all", limit: 100 }, me);
  const withRev = r.tasks.filter((t) => t.revision > 0).sort((a, b) => b.revision - a.revision);
  if (!withRev.length) return [text("No task has needed a revision so far ✓")];
  const by = {};
  for (const t of withRev) by[first(t.assignee) || "—"] = (by[first(t.assignee) || "—"] || 0) + t.revision;
  return [
    text(`**${plural(withRev.length, "task has", "tasks have")}** had revisions (${withRev.reduce((n, t) => n + t.revision, 0)} in total).`),
    chart({ type: "bar", title: "Revisions per person", labels: Object.keys(by), datasets: [{ label: "Revisions", values: Object.values(by) }] }),
    { type: "table", columns: ["Task", "Brand", "Person", "Revisions", "Status"], rows: withRev.slice(0, 20).map((t) => ({ href: `/tasks/${t.id}`, cells: [t.title, t.brand || "—", first(t.assignee), t.revision, t.status] })) },
  ];
}

async function kindAnswer(me, q, kind) {
  const filter = has(q, W.late) ? "late" : has(q, W.done) ? "approved" : has(q, W.pending) ? "open" : "all";
  const r = await READ.list_tasks({ filter, kind, limit: 30 }, me);
  const label = { all: "", open: " pending", late: " late", approved: " approved" }[filter];
  const many = kindPlural(kind).toLowerCase();
  return r.total ? [text(`There ${r.total === 1 ? "is" : "are"} **${r.total} ${r.total === 1 ? kind : many}${label}**:`), taskTable(r.tasks)] : [text(`There are no${label} ${many}.`)];
}

async function allLeadRows() {
  const { data } = await db().from("leads").select("status, assigned_to, source, created_at, updated_at").limit(5000);
  return data || [];
}

async function leadsBySource(me) {
  if (!canSeeAllLeads(me)) return [text("Only admin and ops can see leads.")];
  const rows = await allLeadRows();
  const by = {};
  for (const l of rows) by[l.source || "unknown"] = (by[l.source || "unknown"] || 0) + 1;
  const ranked = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return [text("No leads have come in yet.")];
  return [
    text(`Most leads came from **${ranked[0][0]}** (${ranked[0][1]}). ${plural(rows.length, "lead", "leads")} in total.`),
    chart({ type: "pie", title: "Leads by source", labels: ranked.map(([s]) => s), datasets: [{ label: "Leads", values: ranked.map(([, n]) => n) }] }),
  ];
}

async function leadsByOwner(me) {
  if (!canSeeAllLeads(me)) return [text("Only admin and ops can see leads.")];
  const [rows, team] = await Promise.all([allLeadRows(), people()]);
  const name = Object.fromEntries(team.map((m) => [m.id, m.name]));
  const by = {};
  for (const l of rows) {
    const k = name[l.assigned_to] || "Unassigned";
    by[k] ||= { open: 0, won: 0, lost: 0 };
    if (l.status === "Won") by[k].won += 1;
    else if (l.status === "Lost") by[k].lost += 1;
    else if (!CLOSED_STATUSES.includes(l.status)) by[k].open += 1;
  }
  const list = Object.entries(by).sort((a, b) => b[1].open - a[1].open);
  if (!list.length) return [text("No leads have come in yet.")];
  return [
    text(`**${first(list[0][0])}** has the most open leads (${list[0][1].open}).`),
    chart({ type: "bar", title: "Leads per person", labels: list.map(([n]) => first(n)), datasets: [{ label: "Open", values: list.map(([, v]) => v.open) }, { label: "Won", values: list.map(([, v]) => v.won) }] }),
    { type: "table", columns: ["Person", "Open", "Won", "Lost"], rows: list.map(([n, v]) => ({ cells: [n, v.open, v.won, v.lost] })) },
  ];
}

async function conversionAnswer(me) {
  if (!canSeeAllLeads(me)) return [text("Only admin and ops can see leads.")];
  const rows = await allLeadRows();
  const won = rows.filter((l) => l.status === "Won").length;
  const lost = rows.filter((l) => l.status === "Lost").length;
  const open = rows.filter((l) => !CLOSED_STATUSES.includes(l.status)).length;
  const rate = won + lost ? Math.round((won / (won + lost)) * 100) : null;
  return [
    text(`**${plural(rows.length, "lead", "leads")}** in total: ${won} won, ${lost} lost, ${open} still open.${rate !== null ? ` Of the leads that closed, **${rate}% were won**.` : " No leads have closed yet."}`),
    chart({ type: "pie", title: "Where leads ended up", labels: ["Won", "Lost", "Open", "Other"], datasets: [{ label: "Leads", values: [won, lost, open, rows.length - won - lost - open] }] }),
  ];
}

async function leastAnswer(me) {
  const [{ people: work }, team] = await Promise.all([READ.team_workload({}, me), people()]);
  const makers = team.filter((m) => m.groups.some((g) => ["design", "video", "development", "execution"].includes(g)));
  const open = Object.fromEntries(work.map((w) => [w.person, w]));
  const list = (makers.length ? makers : team).map((m) => ({ name: m.name, open: open[m.name]?.open || 0, late: open[m.name]?.late || 0 })).sort((a, b) => a.open - b.open);
  if (!list.length) return [text("There is nobody in the team yet.")];
  const free = list.filter((m) => m.open === 0);
  return [
    text(free.length ? `**${free.map((m) => first(m.name)).join(", ")}** ${free.length === 1 ? "has" : "have"} no pending work right now — you can give them a new task.` : `**${first(list[0].name)}** has the least work (${plural(list[0].open, "task", "tasks")}).`),
    chart({ type: "bar", title: "Pending work per person (least first)", labels: list.map((m) => first(m.name)), datasets: [{ label: "Open", values: list.map((m) => m.open) }, { label: "Late", values: list.map((m) => m.late) }] }),
  ];
}

async function onboardingAnswer(me) {
  const { brands } = await READ.list_brands({}, me);
  const list = brands.filter((b) => b.stage !== "active client");
  if (!list.length) return [text("No brands are onboarding — all of them are active clients ✓")];
  return [
    text(`**${plural(list.length, "brand is", "brands are")}** still onboarding:`),
    { type: "table", columns: ["Brand", "Stage"], rows: list.map((b) => ({ cells: [b.name, b.stage] })) },
  ];
}

async function staleLeadsAnswer(me, q) {
  if (!canSeeAllLeads(me)) return [text("Only admin and ops can see leads.")];
  const days = Number((q.match(/(\d+)\s*(din|day)/) || [])[1]) || 5;
  const r = await READ.list_leads({ open_only: true, untouched_for_days: days, limit: 30 }, me);
  return r.total
    ? [text(`**${plural(r.total, "open lead has", "open leads have")}** had no update for ${days}+ days — follow up on these:`), leadTable(r.leads)]
    : [text(`Every open lead was updated in the last ${days} days ✓`)];
}

/** What people can ask Amigo, grouped — shown on the Amigo screen. {person} / {brand} are filled in with real names. */
export const AMIGO_QUESTIONS = [
  ["Overview", ["Aaj ka overview do", "CRM ka summary batao", "Is hafte ka report do"]],
  [
    "Tasks",
    [
      "Aaj kitne tasks pending hain?",
      "Kaunse tasks late hain?",
      "Kal kya kya due hai?",
      "Is hafte kitne tasks due hain?",
      "Kya check karna baaki hai?",
      "Client ke paas kitne tasks hain?",
      "Is hafte kitne task approve hue?",
      "Aaj kitne task approve hue?",
      "Is mahine kitne tasks complete hue?",
      "Kitne reels pending hain?",
      "Kitne posts late hain?",
      "Kitni stories approve hui?",
      "Revisions kis task mein hue?",
    ],
  ],
  [
    "Team",
    [
      "Kis employee ka kitna kaam pending hai?",
      "Sabse zyada kaam kiske paas hai?",
      "Kiske paas sabse kam kaam hai? Kaun free hai?",
      "Team mein kaun kaun hai?",
      "Kitne designers hain?",
      "Video editors kaun kaun hain?",
      "Is mahine sabse zyada kaam kisne kiya?",
      "Best performer this week",
      "Sabse zyada late kaam kiska hai?",
      "{person} ka kaam",
      "{person} ke late tasks",
      "{person} ne is hafte kitna kaam kiya?",
      "{person} ka aaj kya due hai?",
    ],
  ],
  [
    "Brands",
    [
      "Ab tak kitne brands onboard hue?",
      "Is mahine kitne brands onboard hue?",
      "Kis brand ka sabse zyada kaam pending hai?",
      "{brand} ka status",
      "{brand} ke late tasks",
      "Kaunse brands onboarding mein hain?",
      "Kitne clients hain?",
    ],
  ],
  [
    "Leads",
    [
      "Is hafte kitne leads aaye?",
      "Aaj kitne leads aaye?",
      "Total leads kitne hain?",
      "Unassigned leads kaunse hain?",
      "Kis sales person ke paas kitne leads hain?",
      "Leads kahan se aa rahe hain?",
      "Conversion rate kya hai?",
      "Kitne leads won hue?",
      "Negotiation mein kaunse leads hain?",
      "Kaunse leads pe kaafi din se update nahi hua?",
      "{person} ke leads",
    ],
  ],
  ["Meetings & proposals", ["Aaj kitni meetings hain?", "Kal kis kis ki meeting hai?", "Is hafte ki meetings", "Proposals ka kya haal hai?"]],
];

const HELP = [
  "Aaj ka overview do",
  "Kis employee ka kitna kaam pending hai?",
  "Aaj kitne tasks pending hain?",
  "Kaunse tasks late hain?",
  "Kya check karna baaki hai?",
  "Is hafte kitne leads aaye?",
  "Kis brand ka sabse zyada kaam pending hai?",
  "Kal kis kis ki meeting hai?",
  "Ab tak kitne brands onboard hue?",
  "Is mahine sabse zyada kaam kisne kiya?",
  "Team mein kaun kaun hai?",
  "Leads kahan se aa rahe hain?",
];

/** "1 task … hain" → "1 task … hai" */
const grammar = (blocks) =>
  blocks.map((b) => (b.type === "text" ? { ...b, text: b.text.replace(/(\b1 (?:task|lead|naya lead|meeting|proposal)\b[^.:\n]*?)\bhain\b/g, "$1hai") } : b));

/**
 * Keep a chart only when it adds something a sentence can't: at least 3 things to compare (2 if the
 * person asked for a chart), and some real numbers — not a single bar or a row of zeros.
 */
function usefulCharts(blocks, question) {
  const asked = has(norm(question), W.chart);
  return blocks.filter((b) => {
    if (b.type !== "chart") return true;
    const values = (b.spec.datasets || []).flatMap((d) => d.values || []);
    const nonZero = (b.spec.datasets?.[0]?.values || []).filter((v) => v > 0).length;
    if (!values.some((v) => v > 0)) return false;
    if (b.spec.type === "pie") return nonZero >= (asked ? 2 : 3);
    return (b.spec.labels || []).length >= (asked ? 2 : 3);
  });
}

/** Works out what the question is about and answers it from the CRM. Returns display blocks. */
export async function answer(question, me) {
  return usefulCharts(grammar(await understand(question, me)), question);
}

async function understand(question, me) {
  const q = norm(question);
  const [team, { data: brandRows }] = await Promise.all([people(), db().from("brands").select("id, name")]);
  const person = findPerson(q, team);
  const brand = findBrand(q, brandRows || []);
  const p = person ? first(person.name) : "";
  const kind = KIND_WORDS.find(([w]) => q.includes(` ${w}`))?.[1];
  const taskWords = has(q, W.task) || has(q, W.late) || has(q, W.check) || has(q, W.revision);

  if (has(q, W.meeting)) return meetingsAnswer(me, q);
  if (has(q, W.proposal)) return proposalsAnswer(me);
  if (has(q, W.lead)) {
    if (has(q, W.stale)) return staleLeadsAnswer(me, q);
    if (has(q, W.source)) return leadsBySource(me);
    if (has(q, W.conversion)) return conversionAnswer(me);
    const status = STATUS_WORDS.some(([w]) => q.includes(w));
    if (!person && !status && !has(q, W.unassigned) && (q.includes(" kis ") || q.includes("sales person") || q.includes("salesperson") || q.includes(" per ") || q.includes(" har ") || q.includes("kiske") || q.includes("each"))) return leadsByOwner(me);
    return leadsAnswer(me, q, team);
  }
  if (has(q, W.conversion)) return conversionAnswer(me);
  if (has(q, W.perform) && !has(q, W.brand)) return performersAnswer(me, q);
  if (has(q, W.revision) && !person) return revisionsAnswer(me);
  if (brand && !person) {
    const bn = brand.name;
    if (has(q, W.late)) return tasksAnswer(me, "late", { none: `${bn} has no late tasks ✓`, some: (n) => `${bn} has **${plural(n, "late task", "late tasks")}**:` }, { brand });
    if (has(q, W.check)) return tasksAnswer(me, "to_check", { none: `Nothing of ${bn}'s is waiting to be checked.`, some: (n) => `**${plural(n, "task", "tasks")}** of ${bn} ${n === 1 ? "is" : "are"} waiting to be checked:` }, { brand });
    if (has(q, W.done)) return tasksAnswer(me, "approved", { none: `${bn} has no approved tasks yet.`, some: (n) => `${bn} has **${plural(n, "approved task", "approved tasks")}**:` }, { brand });
    return brandAnswer(me, brand);
  }
  if (has(q, W.least) && !has(q, W.lead)) return leastAnswer(me);
  if (has(q, W.most) && (q.includes("paas") || q.includes("pass ") || q.includes("busy")) && !has(q, W.brand)) return workloadAnswer(me);
  // "Team mein kaun kaun hai", "kitne designers hain"
  if (!person && has(q, W.people) && (has(q, W.count) || has(q, W.who)) && !has(q, W.pending) && !has(q, W.late) && !has(q, W.check) && !q.includes("kaam")) return teamAnswer(me, q);

  if (person) {
    if (has(q, W.late)) return tasksAnswer(me, "late", { none: `${p} has no late tasks ✓`, some: (n) => `${p} has **${plural(n, "late task", "late tasks")}**:` }, { person });
    if (has(q, W.check)) return tasksAnswer(me, "to_check", { none: `Nothing of ${p}'s is waiting to be checked.`, some: (n) => `**${plural(n, "task", "tasks")}** from ${p} ${n === 1 ? "is" : "are"} waiting to be checked:` }, { person });
    if (has(q, W.done) || q.includes("kitna kaam kiya") || q.includes("kya kiya")) {
      const days = has(q, W.today) ? 1 : has(q, W.week) ? 7 : has(q, W.month) ? 30 : null;
      const r = await READ.list_tasks({ filter: "approved", person: person.name, approved_within_days: days || undefined, limit: 30 }, me);
      const when = days === 1 ? "today" : days === 7 ? "this week" : days === 30 ? "this month" : "so far";
      return r.total ? [text(`${p} got **${plural(r.total, "task", "tasks")} approved** ${when}:`), taskTable(r.tasks)] : [text(`${p} has no approved tasks ${when}.`)];
    }
    if (has(q, W.today)) return tasksAnswer(me, "due_today", { none: `${p} has nothing due today.`, some: (n) => `${p} has **${plural(n, "task", "tasks")} due today**:` }, { person });
    const w = (await READ.team_workload({ person: person.name }, me)).people[0];
    const tasks = await tasksAnswer(me, "open", { none: `${p} has no pending tasks right now ✓`, some: () => "" }, { person });
    if (!w) return [text(`${person.name} has no tasks right now.`)];
    return [
      text(`**${person.name}** has **${plural(w.open, "task", "tasks")} pending** — ${w.late} late, ${w.due_today} due today, ${w.due_this_week} due this week. ${w.waiting_for_review} waiting to be checked, and ${w.approved_last_7_days} approved in the last 7 days.`),
      ...tasks.filter((b) => b.type !== "text"),
    ];
  }

  if (has(q, W.onboarding) && !has(q, W.count)) return onboardingAnswer(me);
  if (W.client.some((w) => q.includes(w))) return tasksAnswer(me, "with_client", { none: "Nothing is with clients right now.", some: (n) => `**${plural(n, "task is", "tasks are")}** with clients:` });
  if (has(q, W.brand) || has(q, W.onboard)) {
    if (has(q, W.most)) return brandsRanked(me);
    if (has(q, W.count) || has(q, W.onboard) || !taskWords) return brandsCount(me, q);
    return brandsRanked(me);
  }
  if (has(q, W.people) && !has(q, W.pending) && !taskWords) return teamAnswer(me, q);
  if (kind && !has(q, W.who)) return kindAnswer(me, q, kind);

  if (has(q, W.late)) return tasksAnswer(me, "late", { none: "No tasks are late ✓", some: (n) => `**${plural(n, "task is", "tasks are")} late**:`, chartTitle: "Late tasks per person" }, { chartBy: true });
  if (has(q, W.check)) return tasksAnswer(me, "to_check", { none: "Nothing is waiting to be checked ✓", some: (n) => `**${plural(n, "task is", "tasks are")}** waiting to be checked:` });
  if (has(q, W.done)) {
    const days = has(q, W.today) ? 1 : has(q, W.month) ? 30 : 7;
    const r = await READ.list_tasks({ filter: "approved", approved_within_days: days, limit: 30 }, me);
    const when = days === 1 ? "today" : days === 30 ? "in the last 30 days" : "this week";
    return r.total ? [text(`**${plural(r.total, "task was", "tasks were")} approved** ${when}:`), taskTable(r.tasks)] : [text(`No tasks were approved ${when}.`)];
  }
  if ((has(q, W.who) || has(q, W.people)) && (taskWords || has(q, W.pending))) return workloadAnswer(me);
  if (has(q, W.today) && (taskWords || has(q, W.pending))) {
    const due = await tasksAnswer(me, "due_today", { none: "Nothing is due today.", some: (n) => `**${plural(n, "task is", "tasks are")} due today**:` });
    const late = await READ.list_tasks({ filter: "late", limit: 30 }, me);
    return [...due, ...(late.total ? [text(`Also, **${plural(late.total, "task is", "tasks are")} already late**:`), taskTable(late.tasks)] : [])];
  }
  if ((has(q, W.tomorrow) || has(q, W.kal)) && (taskWords || has(q, W.pending)))
    return tasksAnswer(me, "due_tomorrow", { none: "Nothing is due tomorrow.", some: (n) => `**${plural(n, "task is", "tasks are")} due tomorrow**:` });
  if (has(q, W.week) && (taskWords || has(q, W.pending)))
    return tasksAnswer(me, "due_this_week", { none: "Nothing is due this week.", some: (n) => `**${plural(n, "task is", "tasks are")} due this week**:` }, { chartBy: true });
  if (has(q, W.pending) || taskWords || has(q, W.chart)) return workloadAnswer(me);
  if (has(q, W.people)) return teamAnswer(me, q);
  if (has(q, W.overview) || has(q, W.today) || has(q, W.count)) return overviewAnswer(me);

  // Not sure what was asked: show the overview so there is always something useful, plus ideas
  return [text("I didn't fully understand that, so here's the CRM overview 👇 (You can also ask about a person or a brand by name.)"), ...(await overviewAnswer(me)), suggest(HELP)];
}

export const AMIGO_SUGGESTIONS = HELP;
