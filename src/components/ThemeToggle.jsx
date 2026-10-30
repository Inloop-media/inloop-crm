"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

const THEMES = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
];
const COLOR = { light: "#ecebf6", dark: "#0c0b12" };

function switchTo(next) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", next);
  document.cookie = `crm_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR[next]);
  setTimeout(() => root.classList.remove("theme-switching"), 350);
}

/** Light / dark switch. Remembered in a cookie so the server renders the right theme with no flash.
 *  variant: "rail" (vertical pill of two round buttons) or "row" (phone profile sheet). */
export default function ThemeToggle({ initial = "light", variant = "rail" }) {
  const [theme, setTheme] = useState(initial);

  const apply = (next) => {
    if (next === theme) return;
    switchTo(next);
    setTheme(next);
  };

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-panel-2 px-4 py-3">
        <Icon name={theme === "light" ? "sun" : "moon"} size={18} className="text-brand" />
        <span className="flex-1 text-sm">Appearance</span>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} role="radio" aria-checked={theme === t.id} data-on={theme === t.id} onClick={() => apply(t.id)} className="seg-item flex items-center gap-1.5 text-xs">
              <Icon name={t.icon} size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 rounded-full bg-panel p-1.5 shadow-[var(--card-shadow)]" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          title={`${t.label} theme`}
          onClick={() => apply(t.id)}
          className={`grid h-9 w-9 place-items-center rounded-full transition ${theme === t.id ? "solid" : "text-muted hover:text-ink"}`}
        >
          <Icon name={t.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
