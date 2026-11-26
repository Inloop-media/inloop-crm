import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { driveConnection, ensureRoot, saveConnection } from "@/lib/drive";

// Google sends the admin back here after "Connect Drive". Saves the Drive token (server only) and makes the
// "loop – Clients" folder, shared with the team. The brands' folders are made from the Brands page.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const back = (msg) => NextResponse.redirect(`${origin}/brands?drive=${encodeURIComponent(msg)}`);
  const me = await getCurrentMember();
  if (!me || me.role !== "admin") return NextResponse.redirect(`${origin}/`);
  const store = await cookies();
  const state = store.get("drive_state")?.value;
  store.delete("drive_state");
  if (searchParams.get("error")) return back("cancelled");
  if (!state || state !== searchParams.get("state") || !searchParams.get("code")) return back("failed");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: searchParams.get("code"),
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${origin}/api/drive/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.refresh_token) return back("failed");
  // Which Google account it is (from the signed id_token Google just gave us)
  let email = "";
  try {
    email = JSON.parse(Buffer.from(String(data.id_token || "").split(".")[1] || "", "base64url").toString()).email || "";
  } catch {}

  try {
    const old = (await driveConnection()) || {};
    // A different account means a different Drive: start a fresh folder tree
    const same = old.email && old.email === email;
    const conn = { refresh_token: data.refresh_token, email, root_id: same ? old.root_id || null : null, connected_at: new Date().toISOString(), connected_by: me.id };
    await saveConnection(conn);
    if (!same) await db().from("drive_folders").delete().not("id", "is", null);
    const { data: team } = await db().from("members").select("email").eq("active", true);
    conn.root_id = await ensureRoot(conn, (team || []).map((m) => m.email));
    await saveConnection(conn);
  } catch (err) {
    return back(String(err.message || "failed").slice(0, 160));
  }
  return back("connected");
}
