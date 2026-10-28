"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";

/** Asks Google for calendar access (offline, so meetings can be booked later) and comes back to this page. */
export default function ConnectCalendar({ domain, className = "btn-primary", children = "Connect Google Calendar" }) {
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    document.cookie = `crm_next=${encodeURIComponent(window.location.pathname + window.location.search)}; path=/; max-age=600; samesite=lax`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: SCOPE,
        queryParams: { access_type: "offline", prompt: "consent", ...(domain ? { hd: domain } : {}) },
      },
    });
    if (error) setBusy(false);
  };

  return (
    <button type="button" onClick={connect} disabled={busy} className={className}>
      {busy ? "Opening Google…" : children}
    </button>
  );
}
