import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "No access" };

export default async function NoAccess({ searchParams }) {
  const { email } = await searchParams;
  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8">
        <Logo />
        <h1 className="mt-8 text-xl font-semibold">You&apos;re not on the team yet</h1>
        <p className="mt-2 text-sm text-muted">
          {email ? <>{email} isn&apos;t</> : "This account isn't"} added to Inloop CRM. Ask an admin to add you under Team, then sign in again.
        </p>
        <Link href="/login" className="mt-8 inline-block text-sm text-brand hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
