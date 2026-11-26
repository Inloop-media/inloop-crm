"use client";
// Import a month of the content calendar from the team's sheet: paste a Google Sheets link or upload an
// .xlsx / .csv file. Columns are recognised by their names (Date, Type, Content Idea, Creative Brief…),
// you see a preview, then the posts land on the calendar.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import FileDrop from "@/components/FileDrop";
import { fetchSheetCsv, importCalendarItems } from "@/app/(crm)/calendar/actions";
import { parseCSV, rowsToItems } from "@/lib/sheetImport";
import { CALENDAR_FIELDS, taskKindLabel } from "@/lib/constants";

const LABEL = { publish_on: "Date", kind: "Type", title: "Content idea", platform: "Platform", refs: "References", ...Object.fromEntries(CALENDAR_FIELDS.map((f) => [f.id, f.label])) };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const SHEET = /\.(xlsx|csv)$/i;

export default function CalendarImport({ brand, month, monthName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("link");
  const [link, setLink] = useState("");
  const [sheets, setSheets] = useState(null); // xlsx: [{ sheet, data }]
  const [sheetName, setSheetName] = useState("");
  const [result, setResult] = useState(null);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();

  const reset = () => {
    setSheets(null);
    setResult(null);
    setError("");
    setDone("");
  };
  const show = (rows) => {
    const r = rowsToItems(rows, month);
    if (r.error) return setError(r.error), setResult(null);
    setError("");
    setResult(r);
  };

  const fromLink = () =>
    start(async () => {
      reset();
      const res = await fetchSheetCsv(link);
      if (!res.ok) return setError(res.error);
      show(parseCSV(res.text));
    });

  const fromFile = (file) =>
    start(async () => {
      reset();
      if (!file) return;
      try {
        if (/\.csv$/i.test(file.name)) return show(parseCSV(await file.text()));
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const all = await readXlsxFile(file);
        const tabs = (Array.isArray(all) ? all : []).filter((s) => s?.data?.length);
        if (!tabs.length) return setError("That file has no data.");
        // Pick the tab named after this month if there is one (e.g. "November" / "Nov 2026")
        const m = MONTHS[Number(month.slice(5)) - 1];
        const best = tabs.find((s) => s.sheet.toLowerCase().includes(m) || s.sheet.toLowerCase().includes(m.slice(0, 3))) || tabs[0];
        setSheets(tabs);
        setSheetName(best.sheet);
        show(best.data);
      } catch (e) {
        console.error("Sheet import:", e);
        setError("Couldn't read that file. Upload an .xlsx or .csv file (in Google Sheets: File → Download).");
      }
    });

  const save = () =>
    start(async () => {
      const res = await importCalendarItems(brand.id, month, result.items, { replace });
      if (!res.ok) return setError(res.error);
      setDone(`${res.count} post${res.count === 1 ? "" : "s"} added to ${brand.name}'s calendar.`);
      setResult(null);
      router.refresh();
    });

  const outside = result ? result.items.filter((i) => !i.publish_on.startsWith(month)).length : 0;

  return (
    <>
      {/* Drop an .xlsx / .csv anywhere on the calendar: the import opens with it */}
      <FileDrop
        accept={SHEET}
        label={`Drop the sheet to import into ${monthName}`}
        hint=".xlsx or .csv — the month's tab is picked for you"
        onFiles={([file]) => {
          setOpen(true);
          setTab("file");
          fromFile(file);
        }}
      />
      <button onClick={() => (setOpen(true), reset())} className="btn-ghost btn-sm">
        <Icon name="upload" size={13} /> Import sheet
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div className="pop relative flex max-h-[90svh] w-full max-w-3xl flex-col overflow-hidden">
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-medium">Import {monthName} from a sheet</h2>
                <p className="text-xs text-muted">
                  For <b className="font-medium text-ink">{brand.name}</b>. Every column of the sheet is saved under its own name (Content Pillar, Hook…). It needs at least a Date and a Content Idea column.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-panel-2" aria-label="Close">
                <Icon name="x" size={15} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <nav className="seg flex w-fit p-1 text-xs">
                {[
                  ["link", "Google Sheet link"],
                  ["file", "Upload .xlsx / .csv"],
                ].map(([k, l]) => (
                  <button key={k} onClick={() => (setTab(k), reset())} data-on={tab === k} className="seg-item text-xs">
                    {l}
                  </button>
                ))}
              </nav>

              {tab === "link" ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    fromLink();
                  }}
                >
                  <div className="flex gap-2">
                    <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className="field" required />
                    <button disabled={pending} className="btn-primary btn-sm shrink-0">
                      {pending ? "Reading…" : "Read sheet"}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted">Open the month&apos;s tab in Google Sheets and copy the link from the address bar. The sheet must be shared as &quot;Anyone with the link can view&quot;.</p>
                </form>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="well-empty flex cursor-pointer flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted hover:text-ink">
                    <Icon name="upload" size={18} />
                    {pending ? "Reading…" : "Drag the .xlsx / .csv here, or click to choose"}
                    <input type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />
                  </label>
                  {sheets && sheets.length > 1 && (
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Tab
                      <select
                        className="field w-auto py-1.5"
                        value={sheetName}
                        onChange={(e) => {
                          setSheetName(e.target.value);
                          show(sheets.find((s) => s.sheet === e.target.value).data);
                        }}
                      >
                        {sheets.map((s) => (
                          <option key={s.sheet}>{s.sheet}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}

              {error && <p className="rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-400">{error}</p>}
              {done && <p className="rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-400">✓ {done}</p>}

              {result && (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    Columns found:
                    {result.columns.map((c) => (
                      <span key={c.key} className="rounded-full bg-panel-2 px-2 py-0.5 text-ink/80" title={c.key.startsWith("extra:") ? "Saved as it is in the sheet" : `Goes into ${LABEL[c.key] || c.key}`}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-line">
                    {/* The sheet as it will be saved: every column, in the sheet's order, under the sheet's names */}
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="bg-panel-2 text-[11px] uppercase tracking-wide text-muted">
                        <tr>
                          {result.columns.map((c) => (
                            <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((i, k) => (
                          <tr key={k} className="border-t border-line align-top">
                            {result.columns.map((c) => {
                              let v;
                              if (c.key === "publish_on") v = dayFmt.format(new Date(`${i.publish_on}T00:00:00Z`));
                              else if (c.key === "kind") v = taskKindLabel(i.kind);
                              else if (c.key === "refs") v = i.refs?.length ? `${i.refs.length} link${i.refs.length > 1 ? "s" : ""}` : "";
                              else if (c.key.startsWith("extra:")) v = i.extra?.find((x) => `extra:${x.label}` === c.key)?.value;
                              else v = i[c.key];
                              return (
                                <td
                                  key={c.key}
                                  className={`px-3 py-2 ${c.key === "publish_on" ? `whitespace-nowrap ${i.publish_on.startsWith(month) ? "" : "text-amber-400"}` : ""} ${c.key === "title" ? "font-medium" : "text-ink/80"}`}
                                >
                                  <span className="line-clamp-3 block min-w-[90px] max-w-[260px] whitespace-pre-wrap break-words">{v || <span className="text-faint">—</span>}</span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.skipped.length > 0 && (
                    <p className="text-xs text-amber-400">
                      Skipped {result.skipped.length} row{result.skipped.length > 1 ? "s" : ""}: {result.skipped.slice(0, 6).map((s) => `row ${s.row} (${s.reason})`).join(", ")}
                      {result.skipped.length > 6 ? "…" : ""}
                    </p>
                  )}
                  {outside > 0 && <p className="text-xs text-amber-400">{outside} post{outside > 1 ? "s are" : " is"} dated outside {monthName} — they&apos;ll go on their own dates.</p>}
                </>
              )}
            </div>

            {result && result.items.length > 0 && (
              <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
                  Replace {monthName}&apos;s posts that aren&apos;t assigned or posted yet (use when re-importing an updated sheet)
                </label>
                <button onClick={save} disabled={pending} className="btn-primary btn-sm">
                  <Icon name="check" size={13} /> {pending ? "Importing…" : `Import ${result.items.length} post${result.items.length === 1 ? "" : "s"}`}
                </button>
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  );
}
