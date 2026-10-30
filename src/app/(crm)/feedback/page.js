import Link from "next/link";
import FeedbackStatus from "@/components/FeedbackStatus";
import { Avatar, Empty } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { ago } from "@/lib/format";

export const metadata = { title: "Feedback" };

const KIND = {
  problem: { label: "Problem", tint: "tint-pink" },
  idea: { label: "Idea", tint: "tint-blue" },
  general: { label: "Feedback", tint: "tint-lavender" },
};
const TABS = [
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export default async function FeedbackPage({ searchParams }) {
  await requireMember(["admin"]);
  const { show = "open" } = await searchParams;
  const { data } = await db()
    .from("feedback")
    .select("id, kind, message, page, status, created_at, member:members(name)")
    .order("created_at", { ascending: false })
    .limit(300);
  const all = data || [];
  const items = show === "all" ? all : show === "done" ? all.filter((f) => f.status === "done") : all.filter((f) => f.status !== "done");

  const count = (k) => all.filter((f) => f.kind === k && f.status !== "done").length;

  return (
    <div className="page max-w-5xl">
      <header className="rise flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div>
          <p className="text-sm text-muted">What the team says about the CRM</p>
          <h1 className="page-title mt-1">Feedback</h1>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="text-xs text-muted">Open problems</div>
            <div className="mt-1 text-[30px] font-medium leading-none">{count("problem")}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Open ideas</div>
            <div className="mt-1 text-[30px] font-medium leading-none">{count("idea")}</div>
          </div>
        </div>
      </header>

      <nav className="seg rise mt-6">
        {TABS.map((t) => (
          <Link key={t.id} href={`/feedback?show=${t.id}`} data-on={show === t.id} className="seg-item">
            {t.label}
          </Link>
        ))}
      </nav>

      {items.length ? (
        <ul className="rise mt-5 grid gap-4 md:grid-cols-2">
          {items.map((f) => {
            const k = KIND[f.kind] || KIND.general;
            return (
              <li key={f.id} className={`card flex flex-col p-5 ${f.status === "done" ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={f.member?.name || "?"} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{f.member?.name || "Former member"}</span>
                      {f.status === "new" && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" title="New" />}
                    </div>
                    <div className="text-[11px] text-muted">
                      {ago(f.created_at)}
                      {f.page ? ` · on ${f.page}` : ""}
                    </div>
                  </div>
                </div>
                <div className={`mt-4 flex-1 rounded-2xl p-4 ${k.tint}`}>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-ink/60">{k.label}</div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{f.message}</p>
                </div>
                <FeedbackStatus id={f.id} status={f.status} />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="card mt-5">
          <Empty icon="chat">{show === "done" ? "Nothing marked done yet." : "No open feedback. The team is happy — or quiet."}</Empty>
        </div>
      )}
    </div>
  );
}
