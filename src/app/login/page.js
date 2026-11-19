import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase/server";
import GoogleButton from "./GoogleButton";
import ClientLoginForm from "./ClientLoginForm";
import { getCurrentClient } from "@/lib/clients";
import Logo, { InloopMark } from "@/components/Logo";
import Icon from "@/components/Icon";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  const configured = isConfigured();
  if (configured && (await getCurrentMember())) redirect("/");
  if (configured && (await getCurrentClient())) redirect("/client");

  return (
    <main className="relative grid min-h-svh bg-[#09090a] text-ink lg:grid-cols-[1.1fr_1fr]">
      {/* Left: the brand side (desktop only) */}
      <section className="relative hidden overflow-hidden border-r border-white/[0.06] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-1/4 h-[520px] w-[520px] rounded-full bg-[#e5303c] opacity-[0.16] blur-[140px]" />
        <InloopMark size={640} className="pointer-events-none absolute -bottom-20 -right-40 opacity-[0.07]" />

        <div className="relative">
          <Logo height={34} />
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e5303c] shadow-[0_0_10px_#e5303c]" /> The agency workspace
          </p>
          <h2 className="text-[46px] font-semibold leading-[1.05] tracking-[-0.035em]">
            Every task, client <br />and post. <span className="text-[#e5303c]">One place.</span>
          </h2>
          <ul className="mt-8 flex flex-col gap-3 text-[14px] text-ink/80">
            {[
              ["check", "Tasks with priority, so the urgent work is always on top"],
              ["calendar", "Every brand's content calendar in one view"],
              ["team", "Clients approve work and chat with the team"],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[#e5303c]">
                  <Icon name={icon} size={15} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-faint">© {new Date().getFullYear()} Inloop Media</p>
      </section>

      {/* Right: sign in */}
      <section className="relative flex items-center justify-center overflow-hidden px-5 py-12">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[560px] -translate-x-1/2 rounded-full bg-[#e5303c] opacity-[0.10] blur-[120px] lg:opacity-[0.06]" />
        <div className="rise relative w-full max-w-[380px]">
          <div className="flex justify-center lg:hidden">
            <Logo height={40} />
          </div>
          <h1 className="mt-10 text-center text-[32px] font-semibold leading-tight tracking-[-0.03em] lg:mt-0">Welcome back</h1>
          <p className="mt-2 text-balance text-center text-sm text-muted">Sign in to pick up where you left off.</p>

          <div className="mt-9 flex flex-col gap-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Team</div>
            {configured ? (
              <GoogleButton domain={process.env.ALLOWED_DOMAIN} />
            ) : (
              <p className="tint-amber rounded-2xl p-4 text-sm">
                Supabase isn&apos;t connected yet. Add the keys to <code>.env.local</code> — see SETUP.md.
              </p>
            )}
          </div>
          {configured && (
            <div className="mt-6 flex flex-col gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Brand / client</div>
              <ClientLoginForm />
            </div>
          )}
          {error && <p className="tint-pink mt-4 rounded-2xl p-3.5 text-sm">Sign-in didn&apos;t complete. Please try again.</p>}

          <p className="mt-10 text-center text-xs text-faint">Inloop Media</p>
        </div>
      </section>
    </main>
  );
}
