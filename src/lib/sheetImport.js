// Turning a content-calendar sheet (Google Sheets / Excel / CSV) into calendar posts.
// Works on plain rows (arrays of cells), so it runs in the browser before anything is saved.
// The team's sheet has columns like: Date · Type · Notes · Content Idea · Creative Brief · Creative Direction
// · Caption Direction · Content Copy · CTA Objective · Reference(s). Column order and exact names don't matter.

/** Minimal CSV reader: quotes, commas and line breaks inside quotes. */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Field → the header words that mean it (most specific first)
const ALIASES = [
  ["caption_direction", ["caption direction", "caption brief"]],
  ["creative_direction", ["creative direction", "visual direction", "design direction", "direction"]],
  ["creative_brief", ["creative brief", "brief"]],
  ["cta_objective", ["cta objective", "cta", "objective", "call to action"]],
  ["caption", ["content copy", "copy", "caption", "post copy", "text"]],
  ["title", ["content idea", "idea", "topic", "concept", "content", "title", "theme"]],
  ["kind", ["type", "format", "content type", "post type", "creative type"]],
  ["publish_on", ["date", "posting date", "publish date", "post date", "day", "go live"]],
  ["platform", ["platform", "channel"]],
  ["notes", ["notes", "note", "remarks", "comments"]],
  ["refs", ["reference", "references", "ref", "refs", "inspiration", "links", "link"]],
];
const norm = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Which field each column is, from a header row. Unknown columns are null. */
function mapHeader(cells) {
  const used = new Set();
  return cells.map((cell) => {
    const h = norm(cell);
    if (!h) return null;
    for (const [field, words] of ALIASES) if (words.includes(h) && (field === "refs" || !used.has(field))) return used.add(field), field;
    for (const [field, words] of ALIASES) if (words.some((w) => h.includes(w)) && (field === "refs" || !used.has(field))) return used.add(field), field;
    return null;
  });
}

/** The header is the first row (of the first 10) where we recognise a date column and an idea / type column. */
function findHeader(rows) {
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const map = mapHeader(rows[i]);
    if (map.includes("publish_on") && (map.includes("title") || map.includes("kind"))) return { index: i, map };
  }
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/** A cell as a "YYYY-MM-DD" day. `month` ("2026-11") fills in a missing year / month. */
export function parseDay(value, month) {
  const [my, mm] = month.split("-").map(Number);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return ymd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (typeof value === "number") {
    if (value >= 1 && value <= 31) return ymd(my, mm, Math.round(value)); // just the day
    if (value > 20000 && value < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 864e5); // Excel serial date
      return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    return null;
  }
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) {
    // India: day / month / year
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : my;
    return ymd(y, +m[2], +m[1]);
  }
  if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s,/-]*([a-z]{3,})[\s,/-]*(\d{2,4})?/))) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3));
    if (mon >= 0) return ymd(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : my, mon + 1, +m[1]);
  }
  if ((m = s.match(/([a-z]{3,})[\s,/-]*(\d{1,2})(?:st|nd|rd|th)?(?:[\s,/-]*(\d{4}))?/))) {
    const mon = MONTHS.indexOf(m[1].slice(0, 3));
    if (mon >= 0) return ymd(m[3] ? +m[3] : my, mon + 1, +m[2]);
  }
  if ((m = s.match(/^(\d{1,2})$/))) return ymd(my, mm, +m[1]);
  return null;
}

/** "Static" → post, "Reel" → reel, … (unknown → post) */
export function parseType(value) {
  const s = norm(value);
  if (/carou|slide/.test(s)) return "carousel";
  if (/reel|short/.test(s)) return "reel";
  if (/stor/.test(s)) return "story";
  if (/video|youtube/.test(s)) return "video";
  return "post";
}
/** "Instagram + FB", "IG, LinkedIn" → "instagram,facebook" (several platforms allowed). */
function parsePlatform(value) {
  const s = norm(value);
  if (!s) return undefined;
  const out = [];
  if (/insta|\big\b/.test(s)) out.push("instagram");
  if (/face|\bfb\b/.test(s)) out.push("facebook");
  if (/linked/.test(s)) out.push("linkedin");
  if (/you ?tube|\byt\b/.test(s)) out.push("youtube");
  if (/twitter|(^|[^a-z])x([^a-z]|$)/.test(s)) out.push("x");
  return out.length ? out.join(",") : "instagram";
}

/**
 * Rows → posts. Returns { items, skipped: [{ row, reason }], columns: [field…], header: true/false }.
 * Rows without a date carry the last date seen (sheets often leave the date blank for a second post that day).
 */
export function rowsToItems(rows, month) {
  const all = rows || [];
  const blank = (r) => !(r || []).some((c) => String(c ?? "").trim() !== "");
  const head = findHeader(all);
  if (!head) return { items: [], skipped: [], columns: [], error: "Couldn't find the header row. The sheet needs at least a Date column and a Content Idea (or Type) column." };
  const items = [];
  const skipped = [];
  let lastDay = null;
  all.slice(head.index + 1).forEach((r, i) => {
    const rowNo = head.index + i + 2; // the row number people see in the sheet
    if (blank(r)) return;
    const item = { refs: [] };
    head.map.forEach((field, c) => {
      if (!field) return;
      const raw = r[c];
      const text = raw instanceof Date ? raw.toISOString() : String(raw ?? "").trim();
      if (field === "refs") {
        item.refs.push(...text.split(/\n|\s+(?=https?:\/\/)|,\s+(?=https?:\/\/)/).map((x) => x.trim()).filter(Boolean));
      } else if (field === "publish_on") item.publish_on = parseDay(raw, month);
      else if (field === "kind") item.kind = parseType(text);
      else if (field === "platform") item.platform = parsePlatform(text);
      else if (text) item[field] = text;
    });
    if (!item.publish_on && head.map.includes("publish_on") && !String(r[head.map.indexOf("publish_on")] ?? "").trim()) item.publish_on = lastDay;
    if (item.publish_on) lastDay = item.publish_on;
    if (!item.title) item.title = item.creative_brief || item.caption || "";
    if (!item.publish_on) return skipped.push({ row: rowNo, reason: "No date we could read" });
    if (!item.title) return skipped.push({ row: rowNo, reason: "No content idea" });
    items.push({ kind: "post", ...item, title: item.title.slice(0, 200) });
  });
  return { items, skipped, columns: [...new Set(head.map.filter(Boolean))] };
}
