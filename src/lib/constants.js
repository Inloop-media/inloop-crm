// Pipeline stages, in order. `color` drives the dot / chip colour everywhere.
export const STATUSES = [
  { name: "New Lead", color: "#60a5fa" },
  { name: "First Call / Touchbase", color: "#38bdf8" },
  { name: "Follow-up Scheduled", color: "#fbbf24" },
  { name: "Discovery Call", color: "#22d3ee" },
  { name: "Meeting Scheduled", color: "#a78bfa" },
  { name: "In-Person Meeting", color: "#c084fc" },
  { name: "Client Brief Shared to Ops Team", color: "#818cf8" },
  { name: "Proposal Deck in Making", color: "#f472b6" },
  { name: "Strategy / Proposal Discussion", color: "#e879f9" },
  { name: "Negotiation", color: "#fb923c" },
  { name: "Awaiting Client Decision", color: "#facc15" },
  { name: "Won", color: "#4ade80" },
  { name: "On Hold", color: "#9ca3af" },
  { name: "No Response", color: "#64748b" },
  { name: "Lost Lead", color: "#f87171" },
];

export const STATUS_NAMES = STATUSES.map((s) => s.name);
export const statusColor = (name) => (STATUSES.find((s) => s.name === name) || STATUSES[0]).color;

// Picking this status hands the lead from the executive to the ops team
export const OPS_HANDOFF_STATUS = "Client Brief Shared to Ops Team";

export const ROLES = [
  { id: "admin", label: "Admin", help: "Sees everything, manages the team" },
  { id: "ops", label: "Ops", help: "Sees every lead, assigns leads, runs proposals" },
  { id: "executive", label: "Executive", help: "Sees only the leads assigned to them" },
];

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
