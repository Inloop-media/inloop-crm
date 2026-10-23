// Who can do what. Used by pages (to hide controls) and by server actions (to enforce).

export const canSeeAllLeads = (me) => me.role === "admin" || me.role === "ops";
export const canSeeLead = (me, lead) => canSeeAllLeads(me) || lead.assigned_to === me.id;
export const canAssign = (me) => me.role === "admin" || me.role === "ops";
export const canCreateLead = (me) => me.role === "admin" || me.role === "ops";
export const canManageTeam = (me) => me.role === "admin";
