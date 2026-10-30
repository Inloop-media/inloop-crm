"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import PushSetup from "@/components/PushSetup";
import ConnectCalendar from "@/components/ConnectCalendar";
import ThemeToggle from "@/components/ThemeToggle";

function Me({ initials, size = "h-10 w-10 text-xs" }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-soft to-brand font-semibold text-white ${size}`}>{initials}</span>;
}

/** Name, notifications, calendar, theme and sign out — the phone sheet and the desktop menu share it. */
function ProfileBody({ name, initials, roleLabel, calendar, domain, theme, showTheme }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Me initials={initials} size="h-12 w-12 text-sm" />
        <div className="min-w-0">
          <div className="truncate text-base font-medium">{name}</div>
          <div className="truncate text-xs text-muted">{roleLabel}</div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <PushSetup variant="row" />
        {showTheme && <ThemeToggle initial={theme} variant="row" />}
        {calendar !== null && (
          <div className="flex items-center gap-3 rounded-2xl bg-panel-2 px-4 py-3">
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
          <button className="flex w-full items-center gap-3 rounded-2xl bg-panel-2 px-4 py-3 text-left text-sm text-rose-400">
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

// Close a menu whenever the page changes
function useOpen() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    setSeen(path);
    setOpen(false);
  }
  return [open, setOpen];
}

/** Desktop top bar, right side: search, notifications and the profile menu in one pill. */
export function ProfileMenu(props) {
  const [open, setOpen] = useOpen();
  return (
    <div className="pill-group relative">
      <Link href="/leads?view=list" title="Search leads" className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-panel-2 hover:text-ink">
        <Icon name="search" size={17} />
      </Link>
      <PushSetup variant="bell" />
      <button onClick={() => setOpen((o) => !o)} aria-label="Profile" className="rounded-full transition hover:opacity-90">
        <Me initials={props.initials} />
      </button>
      {open && (
        <>
          <button aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="rise pop absolute right-0 top-14 z-40 w-80 p-5">
            <ProfileBody {...props} />
          </div>
        </>
      )}
    </div>
  );
}

/** Phone header: logo on the left, notifications + profile on the right (profile opens a sheet). */
export default function MobileHeader(props) {
  const [open, setOpen] = useOpen();
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-bg/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
        <div className="flex h-16 items-center gap-2 px-4">
          <div className="flex-1">
            <Logo />
          </div>
          <PushSetup variant="bell" />
          <button onClick={() => setOpen(true)} aria-label="Profile">
            <Me initials={props.initials} />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
          <div className="rise absolute inset-x-0 bottom-0 rounded-t-[32px] bg-panel px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-ink/15" />
            <ProfileBody {...props} showTheme />
          </div>
        </div>
      )}
    </>
  );
}
