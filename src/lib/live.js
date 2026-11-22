import "server-only";
import { after } from "next/server";

// Live updates: after anything changes (a task, a calendar post, a requirement, a lead), the server sends
// a "changed" ping on the Supabase Realtime channel `crm-live`. Every open CRM tab listens (LiveRefresh)
// and reloads its data. The ping only says what kind of thing changed — never the data itself; each tab
// reloads through its own permission-checked page.

export const LIVE_CHANNEL = "crm-live";

/** scope: "tasks" | "calendar" | "requirements" | "leads" | "meetings" | … — sent after the response. */
export function pingLive(scope = "all") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const send = () =>
    fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: LIVE_CHANNEL, event: "changed", payload: { scope, at: Date.now() } }] }),
    }).catch(() => {});
  try {
    after(send);
  } catch {
    send();
  }
}
