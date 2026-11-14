import "server-only";
import { randomInt } from "node:crypto";
import { cache } from "react";
import { createAuthClient, db } from "@/lib/supabase/server";
import { ensureBrand, getBrand, onboardBrand } from "@/lib/brands";
import { addEvents } from "@/lib/leads";

// Client logins: an ID like "shadowe" + a password. Supabase Auth needs an email, so each ID maps to
// an address on our own domain that never receives mail.
const LOGIN_DOMAIN = "clients.inloopmedia.com";
export const clientEmail = (loginId) => `${String(loginId).toLowerCase()}@${LOGIN_DOMAIN}`;
export const cleanLoginId = (v) => String(v || "").trim().toLowerCase().replace(/@.*$/, "").replace(/[^a-z0-9.-]/g, "");

const slug = (name) =>
  String(name || "client")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18) || "client";

/** Easy to read out on a call, hard to guess: Shadowe-4821-kq */
function newPassword(name) {
  const word = slug(name).slice(0, 8);
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const tail = letters[randomInt(letters.length)] + letters[randomInt(letters.length)];
  return `${word[0].toUpperCase()}${word.slice(1)}-${randomInt(1000, 10000)}-${tail}`;
}

export async function getClientAccount(brandId) {
  const { data, error } = await db().from("client_accounts").select("*").eq("brand_id", brandId).maybeSingle();
  return error ? null : data;
}

/** The brand's client login, created on first call. */
export async function ensureClientAccount(brand) {
  const found = await getClientAccount(brand.id);
  if (found) return { ok: true, account: found };
  const base = slug(brand.name);
  let loginId = base;
  for (let n = 2; n < 50; n++) {
    const { data: taken } = await db().from("client_accounts").select("id").eq("login_id", loginId).maybeSingle();
    if (!taken) break;
    loginId = `${base}${n}`;
  }
  const password = newPassword(brand.name);
  const { data: created, error } = await db().auth.admin.createUser({
    email: clientEmail(loginId),
    password,
    email_confirm: true,
    user_metadata: { client: true, brand_id: brand.id, full_name: brand.name },
  });
  if (error) return { ok: false, error: `Couldn't create the client login: ${error.message}` };
  const { data: account, error: insErr } = await db()
    .from("client_accounts")
    .insert({ brand_id: brand.id, login_id: loginId, auth_user_id: created.user.id, password })
    .select("*")
    .single();
  if (insErr) {
    await db().auth.admin.deleteUser(created.user.id);
    return { ok: false, error: insErr.message };
  }
  return { ok: true, account };
}

/** New password for a brand's login (e.g. it was shared with the wrong person). */
export async function resetClientPassword(brandId) {
  const account = await getClientAccount(brandId);
  if (!account) return { ok: false, error: "No login yet." };
  const brand = await getBrand(brandId);
  const password = newPassword(brand?.name);
  const { error } = await db().auth.admin.updateUserById(account.auth_user_id, { password });
  if (error) return { ok: false, error: error.message };
  await db().from("client_accounts").update({ password }).eq("id", account.id);
  return { ok: true };
}

/**
 * Lead marked Won → brand onboarded right away (no MOU step for now), everyone gets the celebration,
 * and the brand gets its client login.
 */
export async function onboardLead(leadId, actorId) {
  const brand = await ensureBrand(leadId, actorId);
  if (!brand) return { ok: false, error: "Lead not found." };
  if (brand.stage !== "active") {
    const res = await onboardBrand(brand, actorId);
    if (res.ok) await addEvents(leadId, actorId, [{ type: "onboarded", data: { brand: brand.name } }]);
  }
  return ensureClientAccount(brand);
}

/** Client logins for the admin dashboard, newest brands first. */
export async function listClientAccounts() {
  const { data, error } = await db()
    .from("client_accounts")
    .select("id, login_id, password, last_login_at, created_at, brand:brands(id, name, lead_id, onboarded_at)")
    .order("created_at", { ascending: false })
    .limit(50);
  return error ? [] : data || [];
}

/** The signed-in client's account + brand, or null (cached per render). */
export const getCurrentClient = cache(async () => {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await db()
    .from("client_accounts")
    .select("id, login_id, brand:brands(id, name, stage, services, onboarded_at, lead_id)")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return error || !data?.brand ? null : data;
});
