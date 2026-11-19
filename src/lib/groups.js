// Who runs a group. Plain functions, safe on the server and in the browser.
//
//   Admin → CBO (kind "execution") — its heads are the CBOs, Chief Business Officers (Udit sir, Krish sir, Arushi ma'am).
//   Every other group "comes under" one CBO (groups.owner_id) and can have its own heads
//   (groups.head_ids, any number) and team leads (groups.team_lead_ids, people in the group).
//   A group with no heads of its own is headed by the CBO it comes under.
//
// Before migration 021 groups had one head (lead_id) and one team lead (team_lead_id); those still count.

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/** The group's own heads (not the CBO above it). */
export const ownHeadIds = (g) => {
  const h = arr(g?.head_ids);
  return h.length ? h : g?.lead_id ? [g.lead_id] : [];
};

/** Who heads the group day to day: its own heads, else the CBO it comes under. */
export const headIdsOf = (g) => {
  const own = ownHeadIds(g);
  return own.length ? own : g?.owner_id ? [g.owner_id] : [];
};

export const teamLeadIdsOf = (g) => {
  const t = arr(g?.team_lead_ids);
  return t.length ? t : g?.team_lead_id ? [g.team_lead_id] : [];
};

/** Heads + the CBO above it: everyone who runs this group. */
export const runnersOf = (g) => [...new Set([...headIdsOf(g), ...(g?.owner_id ? [g.owner_id] : [])])];

export const runsGroup = (g, memberId) => !!memberId && runnersOf(g).includes(memberId);

export const isOperationsGroup = (g) => g?.kind === "execution";

/** CBOs: the heads of the CBO group(s). */
export const operationsHeadIds = (groups) => [...new Set((groups || []).filter(isOperationsGroup).flatMap(ownHeadIds))];

/** CBO first, then each CBO's groups, then the rest. */
export function sortGroups(groups) {
  const ops = operationsHeadIds(groups);
  const rank = (g) => (isOperationsGroup(g) ? 0 : g.owner_id && ops.includes(g.owner_id) ? 1 + ops.indexOf(g.owner_id) : 99);
  return [...(groups || [])].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
