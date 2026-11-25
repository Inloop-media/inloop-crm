"use client";
// The announcement pop-up: anything admin / the CBOs announced that this person hasn't pressed "Got it" on,
// one at a time, oldest first. Checks again every 45s and whenever the tab comes back.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { Extras, Linkified } from "@/components/Announcements";
import { markAnnouncementSeen } from "@/app/(crm)/announcements/actions";

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function AnnouncementPopup({ initial = [] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [gone, setGone] = useState([]); // pressed "Got it" in this tab

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/announcements", { cache: "no-store" });
        const json = await res.json();
        if (alive && Array.isArray(json.items)) setItems(json.items);
      } catch {}
    };
    const id = setInterval(poll, 45000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  const left = items.filter((a) => !gone.includes(a.id));
  if (!left.length) return null;
  const a = left[0];
  const gotIt = (open) => {
    setGone((g) => [...g, a.id]);
    markAnnouncementSeen(a.id);
    if (open) router.push("/announcements");
  };

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-[rgb(12_11_18/0.55)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={a.title || "Announcement"}>
      <div className="relative max-h-[88svh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-panel shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]">
        <div className="card-coral rounded-b-none p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-white/90">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                <Icon name="speaker" size={15} />
              </span>
              Announcement
            </span>
            {left.length > 1 && <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium tabular-nums">1 of {left.length}</span>}
          </div>
          {a.title && <h2 className="mt-4 text-[24px] font-normal leading-tight tracking-[-0.02em]">{a.title}</h2>}
          <div className="mt-3 flex items-center gap-2 text-[12px] text-white/85">
            <Avatar name={a.author?.name || "Inloop"} size={22} />
            {a.author?.name || "Inloop"} · {when.format(new Date(a.created_at))}
          </div>
        </div>
        <div className="p-5">
          {a.body && <Linkified text={a.body} className="text-[14.5px] leading-relaxed" />}
          <Extras a={a} />
          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={() => gotIt(true)} className="btn-ghost btn-sm">
              All announcements
            </button>
            <button type="button" autoFocus onClick={() => gotIt(false)} className="btn-primary">
              <Icon name="check" size={14} /> Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
