// Who can do what. Used by pages (to hide controls) and by server actions (to enforce).
// `me` is the signed-in member with `groups: [{ id, name, kind }]` (lib/auth.js).
import { EXEC_STATUSES, MAKER_KINDS, STATUS_NAMES } from "@/lib/constants";

export const isAdmin = (me) => me.role === "admin";
const isStaff = (me) => me.role === "admin" || me.role === "ops";
export const inGroupKind = (me, kind) => (me.groups || []).some((g) => g.kind === kind);
export const isSales = (me) => inGroupKind(me, "sales");
export const isStrategist = (me) => inGroupKind(me, "strategy");

// Heads of departments: a group can have a head (groups.lead_id). Their team is everyone in those groups.
export const headsTeam = (me) => (me.ledGroups || []).length > 0;
export const isSalesHead = (me) => (me.ledGroups || []).some((g) => g.kind === "sales");
/** Sales people this member heads (members of the sales groups they lead). */
export const salesTeam = (me) => [...new Set((me.ledGroups || []).filter((g) => g.kind === "sales").flatMap((g) => g.memberIds))];
/** Everyone in the groups this member heads (any kind). */
export const myTeam = (me) => me.team || [];

export const canSeeAllLeads = (me) => isStaff(me);
export const canSeeLead = (me, lead) => canSeeAllLeads(me) || lead.assigned_to === me.id || (isSalesHead(me) && (!lead.assigned_to || salesTeam(me).includes(lead.assigned_to)));
export const canSeeLeads = (me) => isStaff(me) || isSales(me) || isSalesHead(me);
/** Admin / ops assign any lead; a sales head moves leads between people in their team. */
export const canAssign = (me) => isStaff(me) || isSalesHead(me);
/** Leads are added by hand only by admin / ops and the sales head; executives share theirs in the group chat. */
export const canCreateLead = (me) => isStaff(me) || isSalesHead(me);
export const canManageTeam = (me) => isAdmin(me);

// Sales executives move a lead only within New Lead … Discovery Call; the rest is for admin / ops
export const statusOptions = (me) => (isStaff(me) || isSalesHead(me) ? STATUS_NAMES : EXEC_STATUSES);
export const canSetStatus = (me, from, to) => isStaff(me) || isSalesHead(me) || (EXEC_STATUSES.includes(from) && EXEC_STATUSES.includes(to));

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
export const canAssignTasks = (me) => isStaff(me) || isExecHead(me) || headsTeam(me);
/** The employee works on their own tasks; heads / staff see all of them. */
export const canSeeTask = (me, t) => canAssignTasks(me) || t.assignee_id === me.id;
export const canReviewTask = (me, t) => isStaff(me) || t.assigned_by === me.id || isExecHead(me);

// Content calendar: the strategists build it, heads / staff can too; the monthly plan is the heads' call
export const canSeeCalendar = (me) => isStaff(me) || isExecHead(me) || isStrategist(me);
export const canEditCalendar = canSeeCalendar;
export const canSetPlan = (me) => isStaff(me) || isExecHead(me);
