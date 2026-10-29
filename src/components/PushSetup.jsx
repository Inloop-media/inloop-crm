"use client";

import { useEffect, useState, useTransition } from "react";
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
    check()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  const enable = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
    const reg = await navigator.serviceWorker.ready;
    const created = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
    const res = await savePushSubscription(created.toJSON(), navigator.userAgent);
    if (!res.ok) throw new Error(res.error);
    setSub(created);
    setState("on");
    await sendTestPush();
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
  install: { title: "Get the app on your iPhone", text: "In Safari tap Share → Add to Home Screen, open Inloop CRM from there, then turn notifications on." },
  blocked: { title: "Notifications are blocked", text: "Allow notifications for this site in your browser or phone settings, then reload." },
};

export default function PushSetup({ variant = "card" }) {
  const { state, enable, disable } = usePush();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  if (state === "loading" || state === "unsupported") return null;
  const copy = COPY[state];
  const run = (fn) =>
    start(async () => {
      setError("");
      try {
        await fn();
      } catch (err) {
        setError(err.message || "Couldn't turn notifications on.");
      }
    });

  const body = (
    <>
      {state === "on" ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <Icon name="bell" size={14} className="text-emerald-400" />
          <span className="flex-1">Notifications on</span>
          <button onClick={() => run(sendTestPush)} disabled={pending} className="hover:text-white">
            Test
          </button>
          <span className="text-faint">·</span>
          <button onClick={() => run(disable)} disabled={pending} className="hover:text-rose-300">
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
            <button onClick={() => run(enable)} disabled={pending} className="mt-2 text-xs font-medium text-brand hover:underline">
              {pending ? "Turning on…" : "Turn on →"}
            </button>
          )}
        </>
      )}
      {error && <p className="mt-2 text-[11px] text-rose-400">{error}</p>}
    </>
  );

  if (variant === "card") {
    return <div className={`mx-1 mb-3 rounded-lg border p-3 ${state === "on" ? "border-line py-2" : "border-brand/25 bg-brand/[0.06]"}`}>{body}</div>;
  }

  // Mobile top bar: a bell that opens the same card
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-panel-2 hover:text-white"
      >
        <Icon name="bell" />
        {state !== "on" && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-line bg-panel p-3 shadow-2xl">{body}</div>
      )}
    </div>
  );
}
