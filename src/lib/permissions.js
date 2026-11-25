// Who can do what. Used by pages (to hide controls) and by server actions (to enforce).
// `me` is the signed-in member with `groups: [{ id, name, kind }]` (lib/auth.js).
import { EXEC_STATUSES, MAKER_KINDS, STATUS_NAMES } from "@/lib/constants";

export const isAdmin = (me) => me.role === "admin";
const isStaff = (me) => me.role === "admin" || me.role === "ops";
export const inGroupKind = (me, kind) => (me.groups || []).some((g) => g.kind === kind);
export const isSales = (me) => inGroupKind(me, "sales");
export const isStrategist = (me) => inGroupKind(me, "strategy");

// Heads of departments: a group can have heads (groups.head_ids) and comes under a CBO
// (groups.owner_id, see lib/groups.js). Their team is everyone in the groups they run.
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
/** Admin changes any group; a CBO changes the groups that come under them. */
export const canEditGroup = (me, g) => isAdmin(me) || (isOpsHead(me) && !!g && g.owner_id === me.id);
export const canMakeGroups = (me) => isAdmin(me) || isOpsHead(me);

// Sales executives move a lead only within New Lead … Discovery Call; the rest is for admin / ops
export const statusOptions = (me) => (isStaff(me) || isSalesHead(me) ? STATUS_NAMES : EXEC_STATUSES);
export const canSetStatus = (me, from, to) => isStaff(me) || isSalesHead(me) || (EXEC_STATUSES.includes(from) && EXEC_STATUSES.includes(to));

// Meetings: the executive books the discovery call and then the proposal meeting on their own lead.
// Once the proposal meeting is booked their part is done — the proposal work itself stays hidden.
export const canSeeMeetingKind = () => true;
export const canBookDiscovery = (me, lead) => lead.assigned_to === me.id || isStaff(me);
export const canBookProposal = (me, lead) => isStaff(me) || isSalesHead(me) || (!!lead && lead.assigned_to === me.id);

// Proposal pipeline
export const canSeeBriefs = (me) => isStaff(me) || isStrategist(me);
/** A strategist sees briefs nobody has picked up yet, and the ones they picked up. */
export const canSeeProposal = (me, p) =>
  isStaff(me) || (isStrategist(me) && (!p.strategist_id || p.strategist_id === me.id));
export const canWorkOnProposal = (me, p) => isStaff(me) || (isStrategist(me) && p.strategist_id === me.id);
export const canEnterCommercials = (me) => isStaff(me);

// Phase 2 — brands and tasks
export const isExecHead = (me) => inGroupKind(me, "execution") || !!me.opsHead;
/** CBOs (Udit sir, Krish sir, Arushi ma'am) make groups under themselves and pick their heads / team leads. */
export const isOpsHead = (me) => !!me.opsHead;
export const isMaker = (me) => MAKER_KINDS.some((k) => inGroupKind(me, k));
/** Onboarding (MOU, signature) is for admin / ops. */
export const canOnboard = (me) => isStaff(me);
export const canSeeBrands = (me) => isStaff(me) || isExecHead(me);
/** Sales executives pitch with Brand assets instead; everyone else on the team uses the Brand library. */
export const isSalesOnly = (me) => isSales(me) && !isStaff(me) && !isExecHead(me) && !isStrategist(me) && !isMaker(me);
export const canSeeLibrary = (me) => !isSalesOnly(me);
/** Company profiles, decks and past work for pitching: the sales team, sales heads and admin / ops. */
// Development team managers: whoever runs the development group (its head / team lead, or the CBO above it)
export const isDevManager = (me) => (me.ledGroups || []).some((g) => g.kind === "development") || (me.leadGroups || []).some((g) => g.kind === "development");
// Brand assets: sales, the CBOs (Krrish, Udit) and the development team download; admin, the sales head and the dev managers upload
export const canSeeAssets = (me) => isStaff(me) || isSales(me) || isSalesHead(me) || isOpsHead(me) || inGroupKind(me, "development");
export const canManageAssets = (me) => isStaff(me) || isSalesHead(me) || isDevManager(me);
export const canAssignTasks = (me) => isStaff(me) || isExecHead(me) || headsTeam(me);
/** The employee works on their own tasks; heads / staff see all of them. */
export const canSeeTask = (me, t) => canAssignTasks(me) || t.assignee_id === me.id;
export const canReviewTask = (me, t) => isStaff(me) || t.assigned_by === me.id || isExecHead(me);

// Content calendar: the strategists build it, heads / staff can too; the monthly plan is the heads' call
/** The Social Media Management team: posts the client-approved content. */
export const isSocial = (me) => inGroupKind(me, "social");
// Content calendar: the strategists build it, heads / staff can too; the social team sees it (read-only) to post
export const canEditCalendar = (me) => isStaff(me) || isExecHead(me) || isStrategist(me);
export const canSeeCalendar = (me) => canEditCalendar(me) || isSocial(me);
/** Marking a client-approved calendar post as posted: the social team and staff. */
export const canPostContent = (me) => isStaff(me) || isSocial(me);
/**
 * Lock / unlock a brand's content calendar: the creative strategists' team lead, whoever runs that group
 * (its manager / CBO) and admin. While it's locked, no one can change it.
 */
export const canLockCalendar = (me) =>
  isAdmin(me) || (me.leadGroups || []).some((g) => g.kind === "strategy") || (me.ledGroups || []).some((g) => g.kind === "strategy");
/** Delete posts from a brand's content calendar (one by one, or clear a month): admin and the creative strategists. */
export const canDeleteCalendar = (me) => isAdmin(me) || isStrategist(me) || canLockCalendar(me);
/** The monthly deliverables of a brand (how many posts, reels, stories…) are set by admin only. */
export const canSetPlan = (me) => isAdmin(me);
// Announcements to the whole team: admin and the CBOs
export const canAnnounce = (me) => isAdmin(me) || isOpsHead(me);
