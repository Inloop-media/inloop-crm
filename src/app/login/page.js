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
    <main className="relative z-[1] flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[460px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/[0.14] blur-[130px]" />
      <div className="rise relative w-full max-w-[400px]">
        <div className="card p-8 sm:p-10">
          <Logo />
          <h1 className="mt-10 font-serif text-[44px] font-normal leading-[0.95]">
            Welcome <em className="serif-accent pr-1">back</em>
          </h1>
          <p className="mt-3 text-sm text-muted">Sign in with your Inloop Media Google account.</p>
          <div className="mt-8">
            {configured ? (
              <GoogleButton domain={process.env.ALLOWED_DOMAIN} />
            ) : (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                Supabase isn&apos;t connected yet. Add the keys to <code>.env.local</code> — see SETUP.md.
              </p>
            )}
          </div>
          {error && <p className="mt-4 text-sm text-red-400">Sign-in didn&apos;t complete. Please try again.</p>}
        </div>
        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.16em] text-faint">Inloop Media · internal</p>
      </div>
    </main>
  );
}
