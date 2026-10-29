"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import PushSetup from "@/components/PushSetup";
import ConnectCalendar from "@/components/ConnectCalendar";

/** Phone header: logo on the left, notifications + profile on the right (profile opens a sheet). */
export default function MobileHeader({ name, initials, roleLabel, calendar, domain }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // Close the profile sheet when the page changes
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b0b0e]/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="flex-1">
            <Logo />
          </div>
          <PushSetup variant="bell" />
          <button
            onClick={() => setOpen(true)}
            aria-label="Profile"
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-fuchsia-400 text-xs font-semibold text-black"
          >
            {initials}
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="rise absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/[0.08] bg-panel px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand to-fuchsia-400 text-sm font-semibold text-black">
                {initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-base font-medium">{name}</div>
                <div className="truncate text-xs text-muted">{roleLabel}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <PushSetup variant="row" />
              {calendar !== null && (
                <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5">
                  <Icon name="calendar" size={18} className={calendar ? "text-emerald-400" : "text-brand"} />
                  <span className="flex-1 text-sm">{calendar ? "Calendar connected" : "Connect your calendar"}</span>
                  {calendar ? (
                    <Icon name="check" size={16} className="text-emerald-400" />
                  ) : (
                    <ConnectCalendar domain={domain} className="text-sm font-medium text-brand">
                      Connect
                    </ConnectCalendar>
                  )}
                </div>
              )}
              <form action="/auth/signout" method="post">
                <button className="flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left text-sm text-rose-300">
                  <Icon name="logout" size={18} />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
