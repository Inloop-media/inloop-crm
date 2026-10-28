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
  { id: "other", label: "Other", help: "A label only, no extra access" },
];

export const MEETING_MINUTES = { discovery: 30, proposal: 30 };
export const MEETING_KINDS = {
  discovery: { label: "Discovery call", color: "#22d3ee" },
  proposal: { label: "Proposal meeting", color: "#a78bfa" },
};

// What the strategist uploads. reference_links + brand_identity feed the CRL bot, so they must be PDFs.
export const DOC_KINDS = [
  { id: "reference_links", label: "Reference links", help: "Content reference PDF with the IG / Pinterest links, by pillar", pdf: true },
  { id: "creatives", label: "Creatives", help: "Creative references — files or a Drive link" },
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
  { id: "proposal_ready", label: "Strategy doc & deck ready", icon: "sparkle" },
  { id: "brief_shared", label: "New briefs for strategists", icon: "brief" },
  { id: "proposal_meeting", label: "Proposal meetings booked (with brief)", icon: "calendar" },
  { id: "bot_failed", label: "Bot failures", icon: "alert" },
];
