// Lead statuses, in order. `color` drives the dot / chip colour everywhere.
export const STATUSES = [
  { name: "New Lead", color: "#60a5fa" },
  { name: "First Call / Touchbase", color: "#38bdf8" },
  { name: "Follow-up Scheduled", color: "#fbbf24" },
  { name: "DNP", color: "#a1a1aa", help: "Did not pick up" },
  { name: "Discovery Call", color: "#22d3ee" },
  { name: "Proposal Meeting Scheduled", color: "#a78bfa" },
  { name: "Negotiation", color: "#fb923c" },
  { name: "Waiting Client Decision", color: "#facc15" },
  { name: "Won", color: "#4ade80" },
  { name: "On Hold", color: "#9ca3af" },
  { name: "Lost", color: "#f87171" },
  { name: "No Response", color: "#64748b" },
];

export const STATUS_NAMES = STATUSES.map((s) => s.name);
export const statusColor = (name) => (STATUSES.find((s) => s.name === name) || { color: "#9ca3af" }).color;

// Sales executives can only pick these; everything after Discovery Call is the admin's
export const DISCOVERY_STATUS = "Discovery Call";
export const EXEC_STATUSES = STATUS_NAMES.slice(0, STATUS_NAMES.indexOf(DISCOVERY_STATUS) + 1);
// Booking the proposal meeting moves the lead here and shares the brief with the strategists
export const PROPOSAL_STATUS = "Proposal Meeting Scheduled";
// The stages a sales executive sees in filters: up to the proposal meeting, after that the admin takes over
export const EXEC_VISIBLE_STATUSES = STATUS_NAMES.slice(0, STATUS_NAMES.indexOf(PROPOSAL_STATUS) + 1);

// Not counted as open pipeline on the dashboard
export const CLOSED_STATUSES = ["Won", "Lost", "No Response", "On Hold"];

export const ROLES = [
  { id: "admin", label: "Admin", help: "Everything, including Team & Groups" },
  { id: "ops", label: "Ops", help: "Every lead, assigning and proposals — not Team & Groups" },
  { id: "member", label: "Member", help: "What they can do comes from their groups" },
];

export const GROUP_KINDS = [
  { id: "sales", label: "Sales executives", help: "Get leads assigned, update status up to Discovery Call, book the discovery call" },
  { id: "strategy", label: "Creative strategists", help: "See shared briefs, pick one up and upload the 4 documents" },
  { id: "execution", label: "CBO", help: "Chief Business Officers: see every brand, make groups under themselves, pick their heads and team leads, assign and review work" },
  { id: "design", label: "Designers", help: "Get design tasks (posts, carousels, stories) and deliver them" },
  { id: "development", label: "Developers", help: "Get website / development tasks and deliver them" },
  { id: "video", label: "Video editors", help: "Get reels and video tasks and deliver them" },
  { id: "performance", label: "Performance marketing", help: "Get ads and performance tasks and deliver them" },
  { id: "social", label: "Social media management", help: "Get posting, scheduling and community tasks and deliver them" },
  { id: "production", label: "Production", help: "Get shoots and production tasks and deliver them" },
  { id: "other", label: "Other", help: "A label only, no extra access" },
];
// Groups whose members do the execution work (and show up in the task assignee picker)
export const MAKER_KINDS = ["design", "development", "video", "performance", "social", "production"];

export const MEETING_MINUTES = { discovery: 30, proposal: 30 };
export const MEETING_KINDS = {
  discovery: { label: "Discovery call", color: "#22d3ee" },
  proposal: { label: "Proposal meeting", color: "#a78bfa" },
};

// What the strategist uploads. reference_links + brand_identity feed the CRL bot, so they must be PDFs;
// creatives are images that go straight into the proposal deck.
export const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
export const DOC_KINDS = [
  { id: "reference_links", label: "Reference links", help: "Content reference PDF with the IG / Pinterest links, by pillar", pdf: true },
  { id: "creatives", label: "Creatives", help: "Sample creative images (JPG / PNG / WebP) — the bot puts these straight into the proposal deck", images: true },
  { id: "brand_strategy", label: "Brand strategy", help: "Strategy notes / document" },
  { id: "brand_identity", label: "Brand identity", help: "Brand identity PDF — colours, fonts, logo", pdf: true },
];

export const PROPOSAL_STAGES = {
  brief_shared: { label: "Brief shared", step: 0 },
  picked_up: { label: "Strategist working", step: 1 },
  crl_queued: { label: "CRL queued", step: 2 },
  crl_running: { label: "CRL building", step: 2 },
  crl_failed: { label: "CRL failed", step: 2, error: true },
  awaiting_commercials: { label: "Needs commercials", step: 3 },
  proposal_queued: { label: "Proposal queued", step: 4 },
  proposal_running: { label: "Proposal building", step: 4 },
  proposal_failed: { label: "Proposal failed", step: 4, error: true },
  proposal_review: { label: "Review the deck", step: 4 },
  done: { label: "Proposal ready", step: 5 },
};
export const PROPOSAL_STEPS = ["Brief", "Documents", "CRL", "Commercials", "Strategy & deck", "Ready"];

// Same options as the website form (inloop-website src/data/services.js)
export const SERVICES = [
  "Brand Strategy & Identity",
  "Social Media Management",
  "Website Design & Development",
  "Influencer Marketing",
  "Performance & Paid Media",
  "AI-Powered Creative",
  "Creator Management",
  "Creative Production",
  "Strategic PR & Comms",
  "Content Creation",
  "SEO & Search",
  "E-commerce Growth",
  "Not sure / open to recommendation",
];

export const BUDGETS = ["Under ₹50K / month", "₹50K to ₹2L / month", "₹2L to ₹5L / month", "₹5L+ / month", "Not sure yet"];


// Updates a group can receive in its feed (Team → group → "Posts here"). Order = how they're listed.
export const UPDATE_EVENTS = [
  { id: "crl_ready", label: "CRL live links", icon: "link" },
  { id: "proposal_ready", label: "Proposal deck ready", icon: "sparkle" },
  { id: "brief_shared", label: "New briefs for strategists", icon: "brief" },
  { id: "proposal_meeting", label: "Proposal meetings booked (with brief)", icon: "calendar" },
  { id: "bot_failed", label: "Bot failures", icon: "alert" },
];

/* ------------------------------ Phase 2 ------------------------------ */

export const BRAND_STAGES = {
  mou_draft: { label: "MOU draft", tint: "amber" },
  mou_sent: { label: "Waiting for signature", tint: "lavender" },
  active: { label: "Onboarded", tint: "green" },
};

export const TASK_KINDS = [
  { id: "post", label: "Static", group: "design" },
  { id: "carousel", label: "Carousel", group: "design" },
  { id: "story", label: "Story", group: "design" },
  { id: "reel", label: "Reel", group: "video" },
  { id: "video", label: "Video", group: "video" },
  { id: "design", label: "Design", group: "design" },
  { id: "website", label: "Website", group: "development" },
  { id: "other", label: "Other" },
];
/** Was this task given from a brand's content calendar? (tasks come with `calendar` from TASK_FIELDS) */
export const fromCalendar = (t) => Array.isArray(t?.calendar) ? t.calendar.length > 0 : !!t?.calendar;
export const taskKindLabel = (id) => TASK_KINDS.find((k) => k.id === id)?.label || "Task";

// `who` = whose move it is: the employee (maker), the execution head, the client, or nobody
export const TASK_STATUSES = {
  assigned: { label: "To do", color: "#60a5fa", who: "maker" },
  in_progress: { label: "In progress", color: "#fbbf24", who: "maker" },
  revision: { label: "Revision", color: "#fb7185", who: "maker" },
  completed: { label: "Completed — in review", color: "#a78bfa", who: "head" },
  client_rejected: { label: "Client asked for changes", color: "#f97316", who: "head" },
  sent_to_client: { label: "With client", color: "#22d3ee", who: "client" },
  done: { label: "Approved", color: "#4ade80", who: null },
};
export const OPEN_TASK = ["assigned", "in_progress", "revision"];
/** Task priority — set when assigning; employees see high first. */
export const PRIORITIES = [
  { id: "high", label: "High", color: "#ef4444" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "low", label: "Low", color: "#94a3b8" },
];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
/** Sort tasks: high priority first, then the earliest due date (no date last). */
export const byPriority = (a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) || (a.due_at || "9").localeCompare(b.due_at || "9");
// What the employee can pick from the dropdown on their own task
export const MAKER_STATUS_OPTIONS = ["assigned", "in_progress", "completed"];

// Content calendar
export const PLAN_KINDS = ["post", "carousel", "story", "reel", "video"];
/** The types a content calendar post can be (the dropdown on each post, and the sheet import). */
export const CALENDAR_TYPES = [
  { id: "post", label: "Static" },
  { id: "carousel", label: "Carousel" },
  { id: "reel", label: "Reel" },
  { id: "story", label: "Story" },
];
/** The written brief on a calendar post, in the order the team fills it in. */
export const CALENDAR_FIELDS = [
  { id: "notes", label: "Notes", rows: 2 },
  { id: "creative_brief", label: "Creative brief", rows: 3 },
  { id: "creative_direction", label: "Creative direction", rows: 3 },
  { id: "caption_direction", label: "Caption direction", rows: 2 },
  { id: "caption", label: "Content copy", rows: 4 },
  { id: "cta_objective", label: "CTA objective", rows: 1 },
];
export const PLATFORMS = [
  { id: "instagram", label: "Instagram", short: "IG" },
  { id: "facebook", label: "Facebook", short: "FB" },
  { id: "linkedin", label: "LinkedIn", short: "IN" },
  { id: "youtube", label: "YouTube", short: "YT" },
  { id: "x", label: "X", short: "X" },
  { id: "other", label: "Other", short: "•" },
];
/** A calendar post can go out on several platforms; stored as "instagram,facebook". */
export const platformList = (v) => {
  const ids = String(v || "").split(/[,\s/&+|]+/).map((x) => x.trim().toLowerCase()).filter((x) => PLATFORMS.some((p) => p.id === x));
  return [...new Set(ids)];
};
export const platformValue = (list) => {
  const ids = platformList(Array.isArray(list) ? list.join(",") : list);
  return ids.length ? ids.join(",") : "instagram";
};
export const platformLabel = (v) => platformList(v).map((id) => PLATFORMS.find((p) => p.id === id).label).join(", ");
export const kindPlural = (id) => ({ post: "Static posts", story: "Stories", other: "Other" })[id] || `${taskKindLabel(id)}s`;

/** One colour per kind of content (calendar chips, task tags) */
export const KIND_COLOR = { post: "#3b82f6", carousel: "#8b5cf6", story: "#ec4899", reel: "#f59e0b", video: "#06b6d4", design: "#10b981", website: "#64748b", other: "#64748b" };
