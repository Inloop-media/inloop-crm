"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/(crm)/actions";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function keyBytes(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/**
 * Turns phone / desktop notifications on for this device. On iPhone they only work once the CRM is
 * installed from Safari (Share → Add to Home Screen), so it explains that first.
 *   state: loading | install (iPhone, not installed) | unsupported | off | on | blocked
 */
function usePush() {
  const [state, setState] = useState("loading");
  const [sub, setSub] = useState(null);

  useEffect(() => {
    const check = async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !KEY) return ios && !installed ? "install" : "unsupported";
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const existing = await reg.pushManager.getSubscription();
      setSub(existing);
      // Keep the server copy fresh (e.g. after the CRM's database was reset)
      if (existing) savePushSubscription(existing.toJSON(), navigator.userAgent);
      if (Notification.permission === "denied") return "blocked";
      return existing ? "on" : "off";
    };
    const slow = setTimeout(() => setState((s) => (s === "loading" ? "unsupported" : s)), 8000);
    check()
      .then(setState)
      .catch(() => setState("unsupported"))
      .finally(() => clearTimeout(slow));
  }, []);

  // Each step says what went wrong instead of silently doing nothing (iPhone is strict about this flow)
  const enable = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("This browser can't show notifications — open loop from the Home Screen icon (iPhone) or Chrome (Android).");
    // Asked straight from the tap — iPhone ignores the request otherwise
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "blocked" : "off");
      if (permission === "denied") return;
      throw new Error("Tap Allow when the phone asks.");
    }
    const timeout = (ms, msg) => new Promise((_, no) => setTimeout(() => no(new Error(msg)), ms));
    const reg = await Promise.race([
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(() => navigator.serviceWorker.ready),
      timeout(15000, "The app didn't finish setting up — close it fully, open it again and retry."),
    ]);
    let created = await reg.pushManager.getSubscription();
    if (!created) {
      try {
        created = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
      } catch (err) {
        throw new Error(`The phone refused: ${err.message || err.name}. Close the app, open it again from the Home Screen and retry.`);
      }
    }
    const res = await savePushSubscription(created.toJSON(), navigator.userAgent).catch(() => ({ ok: false, error: "Couldn't reach loop — check you're signed in inside the app, then retry." }));
    if (!res?.ok) throw new Error(res?.error || "Couldn't save — sign in inside the app and retry.");
    setSub(created);
    setState("on");
    await sendTestPush().catch(() => {});
  };

  const disable = async () => {
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setSub(null);
    setState("off");
  };

  return { state, enable, disable };
}

const COPY = {
  off: { title: "Turn on notifications", text: "Get a ping on this device when a lead, brief or commercials needs you." },
  install: { title: "Get the app on your iPhone", text: "In Safari tap Share → Add to Home Screen, open Inloop from there, then turn notifications on." },
  blocked: { title: "Notifications are blocked", text: "iPhone: Settings → Notifications → loop → Allow Notifications, then reopen the app. Android / laptop: tap the lock next to the address → Notifications → Allow, then reload." },
  unsupported: {
    title: "Can't turn on notifications here",
    text: "This browser can't show them. iPhone: open inloophub.com in Safari → Share → Add to Home Screen, open loop from there and tap the bell. Android: open inloophub.com in Chrome.",
  },
  loading: { title: "Checking notifications…", text: "" },
};

export default function PushSetup({ variant = "card" }) {
  const { state, enable, disable } = usePush();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  // The bell always shows — when this device can't do notifications it says how to get them
  const copy = COPY[state];
  // Called straight from the tap (no transition in between), so the phone shows its Allow prompt
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message || "Couldn't turn notifications on.");
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <>
      {state === "on" ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Icon name="bell" size={14} className="text-emerald-400" />
          <span className="flex-1">Notifications on</span>
          <button onClick={() => run(sendTestPush)} disabled={busy} className="hover:text-ink">
            Test
          </button>
          <span className="text-faint">·</span>
          <button onClick={() => run(disable)} disabled={busy} className="hover:text-rose-300">
            Off
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs font-medium">
            <Icon name="bell" size={14} className="text-brand" />
            {copy.title}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{copy.text}</p>
          {state === "off" && (
            <button onClick={() => run(enable)} disabled={busy} className="mt-2 text-xs font-medium text-brand hover:underline">
              {busy ? "Turning on…" : "Turn on →"}
            </button>
          )}
        </>
      )}
      {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}
    </>
  );

  if (variant === "row") {
    return (
      <div className="rounded-2xl border border-line px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Icon name="bell" size={18} className={state === "on" ? "text-emerald-400" : "text-brand"} />
          <span className="flex-1 text-sm">{state === "on" ? "Notifications on" : copy.title}</span>
          {state === "on" ? (
            <span className="flex gap-3 text-sm">
              <button onClick={() => run(sendTestPush)} disabled={busy} className="text-muted">
                Test
              </button>
              <button onClick={() => run(disable)} disabled={busy} className="text-rose-300">
                Turn off
              </button>
            </span>
          ) : (
            state === "off" && (
              <button onClick={() => run(enable)} disabled={busy} className="text-sm font-medium text-brand">
                {busy ? "Turning on…" : "Turn on"}
              </button>
            )
          )}
        </div>
        {state !== "on" && state !== "off" && <p className="mt-2 text-xs leading-relaxed text-muted">{copy.text}</p>}
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>
    );
  }

  if (variant === "card") {
    return <div className={`rounded-xl border p-3 ${state === "on" ? "border-line py-2" : "border-brand/25 bg-brand/[0.06]"}`}>{body}</div>;
  }

  // Mobile top bar: a bell that opens the same card
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className={`relative grid h-10 w-10 place-items-center rounded-full transition ${variant === "circle" ? "h-9 w-9 rounded-lg border border-line bg-panel-2 text-muted hover:text-ink" : open ? "bg-panel-2 text-ink" : "text-muted hover:bg-panel-2 hover:text-ink"}`}
      >
        <Icon name="bell" size={17} />
        {state !== "on" && <span className={`absolute h-2 w-2 rounded-full bg-brand ring-2 ring-panel ${variant === "circle" ? "right-1.5 top-1.5" : "right-2 top-2"}`} />}
      </button>
      {open && (
        <>
          <button aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="rise absolute right-0 top-12 z-40 w-[min(18rem,calc(100vw-2rem))] pop p-4">{body}</div>
        </>
      )}
    </div>
  );
}
