"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { dismissCelebrations } from "@/app/(crm)/brands/actions";

const COLORS = ["#8b93ff", "#f472b6", "#fbbf24", "#4ade80", "#22d3ee", "#fb923c"];
// Fixed pseudo-random confetti so server and client render the same pieces
const PIECES = Array.from({ length: 70 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 100) / 60,
  dur: 2.6 + ((i * 29) % 100) / 70,
  size: 6 + ((i * 17) % 7),
  color: COLORS[i % COLORS.length],
  round: i % 3 === 0,
}));

/** "Welcome to the Loop" pop-up on everyone's screen when a client's MOU is signed. */
export default function Celebration({ initial = [] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/celebrations", { cache: "no-store" });
        const json = await res.json();
        if (alive && json.items?.length) setItems(json.items);
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

  if (!items.length) return null;
  const c = items[0];
  const close = (go) => {
    setItems([]);
    dismissCelebrations();
    if (go && c.brand_id) router.push(`/brands/${c.brand_id}`);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgb(12_11_18/0.55)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={c.title}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {PIECES.map((p, i) => (
          <span
            key={i}
            className="confetti absolute top-[-20px]"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              background: p.color,
              borderRadius: p.round ? "50%" : 2,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>
      <div className="rise card relative w-full max-w-md overflow-hidden p-8 text-center shadow-[var(--pop-shadow)]">
        <span className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, #8b93ff 35%, transparent)" }} />
        <span className="solid relative mx-auto grid h-16 w-16 place-items-center rounded-full">
          <Icon name="sparkle" size={26} />
        </span>
        <p className="relative mt-5 text-xs font-medium uppercase tracking-[0.2em] text-muted">New client onboarded</p>
        <h2 className="relative mt-2 text-[28px] font-medium leading-tight tracking-[-0.02em]">{c.title}</h2>
        <p className="relative mt-3 text-sm leading-relaxed text-muted">{c.body}</p>
        <div className="relative mt-7 flex justify-center gap-2">
          <button onClick={() => close(false)} className="btn-ghost">
            Close
          </button>
          <button onClick={() => close(true)} className="btn-primary">
            Open the brand <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
