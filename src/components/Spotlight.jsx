"use client";

import { useEffect } from "react";

/** Feeds the pointer position into the card under it (--mx / --my), which lights its edge and surface. */
export default function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let last = null;
    const move = (e) => {
      const card = e.target.closest?.(".card") || null;
      if (last && last !== card) {
        last.style.removeProperty("--mx");
        last.style.removeProperty("--my");
      }
      last = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
  return null;
}
