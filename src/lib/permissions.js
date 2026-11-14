// Who can do what. Used by pages (to hide controls) and by server actions (to enforce).
// `me` is the signed-in member with `groups: [{ id, name, kind }]` (lib/auth.js).
import { EXEC_STATUSES, MAKER_KINDS, STATUS_NAMES } from "@/lib/constants";

export const isAdmin = (me) => me.role === "admin";
const isStaff = (me) => me.role === "admin" || me.role === "ops";
export const inGroupKind = (me, kind) => (me.groups || []).some((g) => g.kind === kind);
export const isSales = (me) => inGroupKind(me, "sales");
export const isStrategist = (me) => inGroupKind(me, "strategy");

export const canSeeAllLeads = (me) => isStaff(me);
export const canSeeLead = (me, lead) => canSeeAllLeads(me) || lead.assigned_to === me.id;
export const canSeeLeads = (me) => isStaff(me) || isSales(me);
export const canAssign = (me) => isStaff(me);
export const canCreateLead = (me) => isStaff(me);
export const canManageTeam = (me) => isAdmin(me);

// Sales executives move a lead only within New Lead … Discovery Call; the rest is for admin / ops
export const statusOptions = (me) => (isStaff(me) ? STATUS_NAMES : EXEC_STATUSES);
export const canSetStatus = (me, from, to) => isStaff(me) || (EXEC_STATUSES.includes(from) && EXEC_STATUSES.includes(to));

// Meetings: the executive books the discovery call on their own lead; admin / ops book the proposal
// meeting, which executives never see.
export const canSeeMeetingKind = (me, kind) => kind === "discovery" || canSeeAllLeads(me);
export const canBookDiscovery = (me, lead) => lead.assigned_to === me.id || isStaff(me);
export const canBookProposal = (me) => isStaff(me);

// Proposal pipeline
export const canSeeBriefs = (me) => isStaff(me) || isStrategist(me);
/** A strategist sees briefs nobody has picked up yet, and the ones they picked up. */
export const canSeeProposal = (me, p) =>
  isStaff(me) || (isStrategist(me) && (!p.strategist_id || p.strategist_id === me.id));
export const canWorkOnProposal = (me, p) => isStaff(me) || (isStrategist(me) && p.strategist_id === me.id);
export const canEnterCommercials = (me) => isStaff(me);

// Phase 2 — brands and tasks
export const isExecHead = (me) => inGroupKind(me, "execution");
export const isMaker = (me) => MAKER_KINDS.some((k) => inGroupKind(me, k));
/** Onboarding (MOU, signature) is for admin / ops. */
export const canOnboard = (me) => isStaff(me);
export const canSeeBrands = (me) => isStaff(me) || isExecHead(me);
export const canAssignTasks = (me) => isStaff(me) || isExecHead(me);
/** The employee works on their own tasks; heads / staff see all of them. */
export const canSeeTask = (me, t) => canAssignTasks(me) || t.assignee_id === me.id;
export const canReviewTask = (me, t) => isStaff(me) || t.assigned_by === me.id || isExecHead(me);
