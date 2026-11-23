// Where each content-calendar post stands, in a few buckets — for the brand calendar's status row and
// the "Brands this month" block on the admin / CBO dashboards. Client-safe (no server imports).

export const BUCKETS = [
  { id: "done", label: "Approved", color: "#10b981" },
  { id: "shared", label: "Shared with client", color: "#22d3ee" },
  { id: "ready", label: "Ready for client", color: "#6ee7b7" },
  { id: "review", label: "In review", color: "#a78bfa" },
  { id: "progress", label: "In progress", color: "#fbbf24" },
  { id: "unassigned", label: "Not assigned", color: "" },
];

/** One calendar item → its bucket id. */
export function bucketOf(i) {
  if (i.status === "posted" || i.task?.status === "done") return "done";
  if (!i.task) return "unassigned";
  if (i.task.status === "ready") return "ready";
  if (i.task.status === "sent_to_client") return "shared";
  if (["completed", "client_rejected"].includes(i.task.status)) return "review";
  return "progress";
}

/** { done, shared, ready, review, progress, unassigned, total } for a list of calendar items. */
export function countBuckets(items) {
  const c = Object.fromEntries(BUCKETS.map((b) => [b.id, 0]));
  for (const i of items) c[bucketOf(i)] += 1;
  c.total = items.length;
  return c;
}
