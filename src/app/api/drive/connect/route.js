import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentMember } from "@/lib/auth";
import { DRIVE_SCOPE } from "@/lib/drive";

// Admin → "Connect Drive": off to Google (sign in with the company account, e.g. tech@) and back to /api/drive/callback.
// Only the Drive permission is asked for — the admin's own CRM login doesn't change.
export async function GET(request) {
  const me = await getCurrentMember();
  const { origin } = new URL(request.url);
  if (!me || me.role !== "admin") return NextResponse.redirect(`${origin}/`);
  const state = crypto.randomUUID();
  (await cookies()).set("drive_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${origin}/api/drive/callback`,
    response_type: "code",
    scope: `${DRIVE_SCOPE} openid email`,
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "false",
    state,
    login_hint: "tech@inloopmedia.com",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}
