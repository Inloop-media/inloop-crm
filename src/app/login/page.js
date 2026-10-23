import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase/server";
import GoogleButton from "./GoogleButton";
import Logo from "@/components/Logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  const configured = isConfigured();
  if (configured && (await getCurrentMember())) redirect("/leads");

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8">
        <Logo />
        <h1 className="mt-8 text-xl font-semibold">Sign in to Inloop CRM</h1>
        <p className="mt-2 text-sm text-muted">Use your Inloop Media Google account.</p>
        <div className="mt-8">
          {configured ? (
            <GoogleButton domain={process.env.ALLOWED_DOMAIN} />
          ) : (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              Supabase isn&apos;t connected yet. Add the keys to <code>.env.local</code> — see SETUP.md.
            </p>
          )}
        </div>
        {error && <p className="mt-4 text-sm text-red-400">Sign-in didn&apos;t complete. Please try again.</p>}
      </div>
    </main>
  );
}
