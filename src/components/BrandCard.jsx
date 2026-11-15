// A brand as a card, like the "Saved" cards in the reference: a coloured block on top with the
// headline number, then the name, services and a footer line.
import Link from "next/link";
import Icon from "@/components/Icon";
import { BrandMark } from "@/components/ui";
import { BRAND_STAGES } from "@/lib/constants";
import { fmtDay } from "@/lib/format";

const LOOKS = ["coral", "soft", "dark"];

export default function BrandCard({ b, unread = 0, i = 0 }) {
  const c = b.counts || {};
  const stage = BRAND_STAGES[b.stage];
  const active = b.stage === "active";
  const href = active ? `/brands/${b.id}` : `/leads/${b.lead?.id}#onboarding`;
  const look = active ? LOOKS[i % 3] : "soft";
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const top = {
    coral: "card-coral !rounded-[18px] !shadow-none",
    soft: "bg-[color-mix(in_srgb,var(--color-brand)_14%,var(--color-panel))] text-ink",
    dark: "bg-[#1c1c1f] text-white",
  }[look];
  const sub = look === "soft" ? "text-ink/55" : "text-white/70";
  const track = look === "soft" ? "bg-ink/10" : "bg-white/25";
  const fill = look === "soft" ? "bg-brand" : "bg-white";

  return (
    <Link href={href} className="card card-hover group flex flex-col gap-3 p-3">
      <div className={`relative flex h-36 flex-col justify-between overflow-hidden rounded-[18px] p-4 ${top}`}>
        <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-14 right-10 h-28 w-28 rounded-full bg-white/[0.06]" />
        <div className="relative flex items-center justify-between">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${look === "soft" ? "bg-panel text-ink/70" : "bg-black/25 text-white"}`}>{active ? "Client" : stage.label}</span>
          <BrandMark name={b.name} size={30} />
        </div>
        {active ? (
          <div className="relative">
            <div className="flex items-end justify-between">
              <span className="text-[34px] font-light leading-none tracking-[-0.03em] tabular-nums">
                {c.done || 0}
                <span className={`text-base ${sub}`}> / {c.total || 0}</span>
              </span>
              <span className={`text-[11px] ${sub}`}>approved</span>
            </div>
            <span className={`mt-2.5 block h-1 overflow-hidden rounded-full ${track}`}>
              <span className={`block h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
            </span>
          </div>
        ) : (
          <div className="relative grid flex-1 place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-panel text-brand shadow-[var(--card-shadow)]">
              <Icon name={b.stage === "mou_sent" ? "mail" : "file"} size={18} />
            </span>
          </div>
        )}
      </div>

      <div className="px-1.5">
        <div className="truncate text-[15px] font-medium group-hover:text-brand">{b.name}</div>
        <div className="truncate text-xs text-muted">{(b.services || []).map((s) => s.name).join(" · ") || (active ? "No services listed" : "Onboarding")}</div>
      </div>

      <div className="flex items-center gap-2 px-1.5 pb-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
          {active ? (
            <>
              {c.open || 0} in work
              {c.review ? ` · ${c.review} to check` : ""}
              {c.overdue ? <span className="text-rose-400"> · {c.overdue} late</span> : ""}
            </>
          ) : b.stage === "mou_sent" ? (
            `MOU sent ${fmtDay(b.mou_sent_at)}`
          ) : (
            "MOU being drafted"
          )}
        </span>
        {unread > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-semibold text-white">
            <Icon name="chat" size={11} /> {unread}
          </span>
        )}
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel-2 text-muted transition group-hover:bg-solid group-hover:text-on-solid">
          <Icon name="arrow" size={12} className="-rotate-45" />
        </span>
      </div>
    </Link>
  );
}
