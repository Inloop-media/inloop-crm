"use client";
// Keeps every open CRM tab up to date: when the server pings `crm-live` (someone completed a task, moved
// a post, answered a requirement…), this tab quietly reloads its data. Typing and open pop-ups are kept.
// If the tab was hidden, it catches up as soon as it's looked at again.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LiveRefresh() {
  const router = useRouter();
  const timer = useRef(null);
  const missed = useRef(false);

  useEffect(() => {
    const sb = createClient();
    const reload = () => {
      if (document.hidden) {
        missed.current = true;
        return;
      }
      clearTimeout(timer.current);
      // A few changes often come together — reload once
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    const ch = sb.channel("crm-live").on("broadcast", { event: "changed" }, reload).subscribe();
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      // Back on the tab: catch up if something changed meanwhile (or it was away for a while)
      if (missed.current || (hiddenAt && Date.now() - hiddenAt > 60e3)) {
        missed.current = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(ch);
    };
  }, [router]);

  return null;
}
