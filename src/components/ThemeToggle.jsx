"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

/** Dark / light switch. Remembered in a cookie so the server renders the right theme with no flash. */
export default function ThemeToggle({ initial = "dark", variant = "seg" }) {
  const [theme, setTheme] = useState(initial);

  const apply = (next) => {
    if (next === theme) return;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    document.cookie = `crm_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#f5f5f8" : "#070709");
    setTheme(next);
    setTimeout(() => root.classList.remove("theme-switching"), 300);
  };

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
        <Icon name={theme === "light" ? "sun" : "moon"} size={18} className="text-brand" />
        <span className="flex-1 text-sm">Appearance</span>
        <Seg theme={theme} apply={apply} />
      </div>
    );
  }
  return <Seg theme={theme} apply={apply} wide />;
}

function Seg({ theme, apply, wide }) {
  return (
    <div className={`seg ${wide ? "w-full" : ""}`} role="radiogroup" aria-label="Theme">
      {[
        { id: "dark", label: "Dark", icon: "moon" },
        { id: "light", label: "Light", icon: "sun" },
      ].map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          data-on={theme === t.id}
          onClick={() => apply(t.id)}
          className={`seg-item flex items-center justify-center gap-1.5 text-xs ${wide ? "flex-1" : ""}`}
        >
          <Icon name={t.icon} size={13} />
          {t.label}
        </button>
      ))}
    </div>
  );
}
