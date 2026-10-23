import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = () => Boolean(URL && ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Supabase client tied to the signed-in user's session cookies (used for auth only). */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — the proxy refreshes the session instead
        }
      },
    },
  });
}

let admin;
/** Service-role client for all data access. Server only — never import from a Client Component. */
export function db() {
  if (!admin) {
    admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
