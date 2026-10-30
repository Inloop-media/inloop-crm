import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase/server";
import GoogleButton from "./GoogleButton";
import Logo from "@/components/Logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  const configured = isConfigured();
  if (configured && (await getCurrentMember())) redirect("/");

  return (
    <main className="relative flex min-h-svh items-center justify-center px-4 py-10">
      <div className="rise w-full max-w-[420px]">
        <div className="card p-8 sm:p-10">
          <Logo />
          <h1 className="mt-10 text-[34px] font-medium leading-tight tracking-[-0.02em]">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Sign in with your Inloop Media Google account.</p>
          <div className="mt-8">
            {configured ? (
              <GoogleButton domain={process.env.ALLOWED_DOMAIN} />
            ) : (
              <p className="tint-amber rounded-2xl p-4 text-sm">
                Supabase isn&apos;t connected yet. Add the keys to <code>.env.local</code> — see SETUP.md.
              </p>
            )}
          </div>
          {error && <p className="tint-pink mt-4 rounded-2xl p-3.5 text-sm">Sign-in didn&apos;t complete. Please try again.</p>}
        </div>
        <p className="mt-6 text-center text-xs text-muted">Inloop Media · internal workspace</p>
      </div>
    </main>
  );
}
