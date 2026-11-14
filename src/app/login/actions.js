"use server";

import { createAuthClient, db } from "@/lib/supabase/server";
import { cleanLoginId, clientEmail } from "@/lib/clients";

/** Brand login with the ID + password the admin shared. */
export async function signInClient(loginIdInput, password) {
  const loginId = cleanLoginId(loginIdInput);
  if (!loginId || !password) return { ok: false, error: "Enter your login ID and password." };
  const { data: account } = await db().from("client_accounts").select("id").eq("login_id", loginId).maybeSingle();
  if (!account) return { ok: false, error: "That login ID or password isn't right." };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email: clientEmail(loginId), password: String(password) });
  if (error) return { ok: false, error: /rate|many/i.test(error.message) ? "Too many tries — wait a minute and try again." : "That login ID or password isn't right." };
  await db().from("client_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", account.id);
  return { ok: true };
}
