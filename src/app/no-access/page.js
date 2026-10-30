import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "No access" };

export default async function NoAccess({ searchParams }) {
  const { email } = await searchParams;
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="rise card w-full max-w-[420px] p-8 sm:p-10">
        <Logo />
        <h1 className="mt-10 text-[28px] font-medium leading-tight tracking-[-0.02em]">You&apos;re not on the team yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {email ? <>{email} isn&apos;t</> : "This account isn't"} added to Inloop CRM. Ask an admin to add you under Team, then sign in again.
        </p>
        <Link href="/login" className="btn-primary mt-8">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
