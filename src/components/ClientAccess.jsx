"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { newClientPassword, onboardNow } from "@/app/(crm)/brands/actions";

function CopyButton({ text, label = "Copy", primary }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {}
      }}
      className={primary ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
    >
      <Icon name={done ? "check" : "file"} size={13} /> {done ? "Copied" : label}
    </button>
  );
}

function Secret({ label, value }) {
  return (
    <div className="well flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted">{label}</div>
        <div className="truncate font-mono text-sm font-medium">{value}</div>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

const message = (a, origin) =>
  `Hi ${a.brand?.name || ""} team! Welcome to Inloop Media.\n\n` +
  `Your client dashboard is ready — this is where you'll review and approve every post, reel and video.\n\n` +
  `Link: ${origin}/login\nLogin ID: ${a.login_id}\nPassword: ${a.password}\n\n` +
  `On the sign-in page, choose "Client login".`;

/** One brand's login: ID, password, ready-to-send message (WhatsApp / mail), new password. */
export function ClientLogin({ account, origin, compact = false }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const text = message(account, origin);
  return (
    <div className="flex flex-col gap-2.5">
      {!compact && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon name="team" size={15} /> Client login
          {account.last_login_at ? (
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">Logged in</span>
          ) : (
            <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-medium text-muted">Not used yet</span>
          )}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Secret label="Login ID" value={account.login_id} />
        <Secret label="Password" value={account.password} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} label="Copy message for the client" primary />
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
          <Icon name="chat" size={13} /> WhatsApp
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Make a new password? The old one stops working.")) return;
            start(async () => {
              setError("");
              const r = await newClientPassword(account.brand.id);
              if (!r.ok) setError(r.error);
              else router.refresh();
            });
          }}
          className="ml-auto px-1 text-xs text-muted hover:text-ink"
        >
          {pending ? "Working…" : "New password"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

/** Lead is Won but not onboarded yet (e.g. marked Won before this existed). */
export function OnboardButton({ leadId }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="tint-green flex flex-wrap items-center gap-4 rounded-2xl p-5">
      <span className="icon-tile">
        <Icon name="sparkle" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Onboard this client</div>
        <p className="text-xs text-ink/60">Creates the brand, tells the team and makes the client&apos;s login.</p>
      </div>
      <button
        onClick={() =>
          start(async () => {
            setError("");
            const r = await onboardNow(leadId);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
        disabled={pending}
        className="btn-primary"
      >
        {pending ? "Onboarding…" : "Onboard"} <Icon name="arrow" size={14} />
      </button>
      {error && <p className="w-full text-xs text-rose-400">{error}</p>}
    </div>
  );
}
