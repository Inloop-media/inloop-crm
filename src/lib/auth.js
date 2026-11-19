import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient, db } from "@/lib/supabase/server";
import { operationsHeadIds, runsGroup, teamLeadIdsOf } from "@/lib/groups";

// Everything except the Google refresh token, which never leaves the server helpers in lib/google.js
export const MEMBER_FIELDS = "id, email, name, role, active, created_at, calendar_connected_at";
const BASE_MEMBER_FIELDS = "id, email, name, role, active, created_at";

const adminEmails = () =>
  String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * The member row for an email, or null if they aren't allowed in.
 * Emails in ADMIN_EMAILS are added as admins on their first sign-in, so the CRM can be bootstrapped.
 */
export async function memberForEmail(email, fullName) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;
  let { data: found, error } = await db().from("members").select(MEMBER_FIELDS).eq("email", e).maybeSingle();
  if (error && /calendar_connected_at/.test(error.message)) {
    // supabase/migrations/002_meetings.sql hasn't been run yet — still let people sign in
    ({ data: found, error } = await db().from("members").select(BASE_MEMBER_FIELDS).eq("email", e).maybeSingle());
  }
  if (error) throw new Error(error.message);
  let member = found;
  if (!member && adminEmails().includes(e)) {
    const { data } = await db()
      .from("members")
      .insert({ email: e, name: fullName || e.split("@")[0], role: "admin" })
      .select(BASE_MEMBER_FIELDS)
      .single();
    member = data;
  }
  if (!member || !member.active) return null;
  const [groups, { led, lead, opsHead }] = await Promise.all([groupsOf(member.id), ledGroupsOf(member.id)]);
  // team: everyone in the groups this person heads (empty for people who head nothing)
  const team = [...new Set(led.flatMap((g) => g.memberIds))].filter((id) => id !== member.id);
  return { ...member, groups, ledGroups: led, leadGroups: lead, team, opsHead };
}

/**
 * Groups this member runs — as one of its heads, or as the CBO it comes under:
 * [{ id, name, kind, memberIds, owned }]. Also says whether they head CBO itself.
 */
async function ledGroupsOf(memberId) {
  const { data, error } = await db().from("groups").select("*, group_members(member_id)");
  if (error) return { led: [], lead: [], opsHead: false };
  const all = data || [];
  const led = all
    .filter((g) => runsGroup(g, memberId))
    .map((g) => ({ id: g.id, name: g.name, kind: g.kind, owned: g.owner_id === memberId, memberIds: (g.group_members || []).map((m) => m.member_id) }));
  // groups where this person is a team lead
  const lead = all.filter((g) => teamLeadIdsOf(g).includes(memberId)).map((g) => ({ id: g.id, name: g.name, kind: g.kind }));
  return { led, lead, opsHead: operationsHeadIds(all).includes(memberId) };
}

/** [{ id, name, kind }] — what a member can do beyond their role comes from these. */
async function groupsOf(memberId) {
  const { data, error } = await db().from("group_members").select("group:groups(id, name, kind)").eq("member_id", memberId);
  if (error) return []; // before supabase/migrations/003_groups_proposals.sql is run
  return (data || []).map((r) => r.group).filter(Boolean);
}

/** Signed-in member for this request (cached per render). */
export const getCurrentMember = cache(async () => {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return memberForEmail(user.email, user.user_metadata?.full_name);
});

/**
 * Use at the top of pages and server actions.
 * Optionally limit access: a list of roles, or a check like `canManageTeam` from lib/permissions.
 */
export async function requireMember(allowed) {
  const me = await getCurrentMember();
  if (!me) {
    // Brand logins have their own dashboard
    const { getCurrentClient } = await import("@/lib/clients");
    if (await getCurrentClient()) redirect("/client");
    redirect("/no-access");
  }
  const ok = !allowed || (typeof allowed === "function" ? allowed(me) : allowed.includes(me.role));
  if (!ok) redirect("/");
  return me;
}
