import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { memberForEmail } from "@/lib/auth";

// Google sends people back here after sign-in. Anyone not on the team is signed straight out again.
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
  return NextResponse.redirect(`${origin}/leads`);
}
