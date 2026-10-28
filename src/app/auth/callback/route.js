import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthClient, db } from "@/lib/supabase/server";
import { memberForEmail } from "@/lib/auth";

// Google sends people back here after sign-in. Anyone not on the team is signed straight out again.
// After "Connect Google Calendar" Google also returns a refresh token, which is saved for booking meetings.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) return NextResponse.redirect(`${origin}/login?error=1`);

  const member = await memberForEmail(data.user.email, data.user.user_metadata?.full_name);
  if (!member) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/no-access?email=${encodeURIComponent(data.user.email || "")}`);
  }

  const refreshToken = data.session?.provider_refresh_token;
  if (refreshToken) {
    await db()
      .from("members")
      .update({ google_refresh_token: refreshToken, calendar_connected_at: new Date().toISOString() })
      .eq("id", member.id);
  }

  // Set by the Connect Calendar button so people land back where they were (local paths only)
  const cookieStore = await cookies();
  const next = decodeURIComponent(cookieStore.get("crm_next")?.value || "");
  cookieStore.delete("crm_next");
  const target = /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : "/";
  return NextResponse.redirect(`${origin}${target}`);
}
