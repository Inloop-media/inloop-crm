import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient, db } from "@/lib/supabase/server";

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
  const { data: found } = await db().from("members").select("*").eq("email", e).maybeSingle();
  let member = found;
  if (!member && adminEmails().includes(e)) {
    const { data } = await db()
      .from("members")
      .insert({ email: e, name: fullName || e.split("@")[0], role: "admin" })
      .select()
      .single();
    member = data;
  }
  return member && member.active ? member : null;
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

/** Use at the top of pages and server actions. Optionally limit to some roles. */
export async function requireMember(roles) {
  const me = await getCurrentMember();
  if (!me) redirect("/no-access");
  if (roles && !roles.includes(me.role)) redirect("/leads");
  return me;
}
