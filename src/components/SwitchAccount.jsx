"use client";
// Switch to another team account (e.g. Udit sir's own login ↔ the admin login) in one click: Google's
// account picker opens straight away and the new account replaces this one — no sign out / sign in.
import { useState } from "react";
import Icon from "@/components/Icon";
import { SideButton } from "@/components/Nav";
import { createClient } from "@/lib/supabase/browser";

export function useSwitchAccount(domain) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    // land on the dashboard of the account you switch to
    document.cookie = "crm_next=; path=/; max-age=0";
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account", ...(domain ? { hd: domain } : {}) },
      },
    });
    if (error) setBusy(false);
  };
  return { busy, run };
}

/** variant "side": a sidebar foot button; "row": a row in the profile menu / phone sheet. */
export default function SwitchAccount({ domain, variant = "row" }) {
  const { busy, run } = useSwitchAccount(domain);
  if (variant === "side") return <SideButton label={busy ? "Opening Google…" : "Switch account"} icon="switch" onClick={run} />;
  return (
    <button type="button" onClick={run} disabled={busy} className="flex w-full items-center gap-3 rounded-2xl bg-panel-2 px-4 py-3 text-left text-sm">
      <Icon name="switch" size={18} className="text-muted" />
      <span className="flex-1">{busy ? "Opening Google…" : "Switch account"}</span>
      <span className="text-[11px] text-faint">No need to sign out</span>
    </button>
  );
}
