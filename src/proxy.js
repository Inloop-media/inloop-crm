import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC = ["/login", "/privacy", "/auth", "/no-access", "/api/leads", "/api/worker", "/api/cron", "/sw.js", "/manifest.webmanifest"];

// Refreshes the Supabase session cookie on every request and sends signed-out visitors to /login.
// Who may see what is decided on the server (src/lib/auth.js), not here.
export async function proxy(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Verifies the signed login token locally (and refreshes it when it's about to expire)
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  let user = data?.claims || null;
  // Safety net: only ask the auth server when the local check couldn't confirm a login
  if (!user && request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) user = (await supabase.auth.getUser()).data?.user || null;

  const path = request.nextUrl.pathname;
  if (!user && !PUBLIC.some((p) => path === p || path.startsWith(p + "/"))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
