"use client";
// A long list shows its first few rows; "Show all" opens the rest (so a page of 90 tasks isn't one long scroll).
import { Children, useState } from "react";

export default function ShowMore({ children, limit = 5 }) {
  const [all, setAll] = useState(false);
  const rows = Children.toArray(children);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <>
      {shown}
      {rows.length > limit && (
        <li>
          <button type="button" onClick={() => setAll(!all)} className="mt-2 w-full rounded-xl py-2 text-[12.5px] font-medium text-muted hover:bg-panel-2 hover:text-ink">
            {all ? "Show less" : `Show all ${rows.length}`}
          </button>
        </li>
      )}
    </>
  );
}
