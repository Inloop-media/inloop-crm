"use client";
// Amigo — ask the CRM anything in plain English or Hinglish. Each question goes to /api/amigo, which
// answers from the CRM's own database (no outside AI) with text, tables, charts and links. The
// conversation is kept on this device only.
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import QuickAssign from "@/components/QuickAssign";

const COLORS = ["#60a5fa", "#ef3340", "#4ade80", "#fbbf24", "#a78bfa", "#22d3ee", "#f472b6", "#94a3b8"];
// "Late" is always red, so it reads the same in every chart
const colorOf = (d, k) => (/late|overdue/i.test(d?.label || "") ? "#f2555a" : COLORS[k % COLORS.length]);

/* --------------------------- tiny markdown --------------------------- */

function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {p.slice(2, -2)}
      </strong>
    ) : p.startsWith("`") && p.endsWith("`") ? (
      <code key={i} className="rounded-md bg-panel-3 px-1.5 py-0.5 font-mono text-[12px]">
        {p.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function Markdown({ text }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = rows.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      const [head, ...body] = cells;
      out.push(
        <div key={i} className="my-2 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-panel-2 text-[11px] uppercase tracking-wide text-muted">
              <tr>{head?.map((c, j) => <th key={j} className="px-3 py-2 font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k} className="border-t border-line">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2">
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+\.)\s+/, ""));
      i--;
      const L = ordered ? "ol" : "ul";
      out.push(
        <L key={i} className={`my-1.5 flex flex-col gap-1 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-faint`}>
          {items.map((it, k) => (
            <li key={k}>
              <Inline text={it} />
            </li>
          ))}
        </L>,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      out.push(
        <p key={i} className="mt-3 text-[15px] font-semibold first:mt-0">
          <Inline text={h[2]} />
        </p>,
      );
      continue;
    }
    out.push(
      <p key={i} className="my-1.5">
        <Inline text={line} />
      </p>,
    );
  }
  return <div className="text-[14px] leading-relaxed text-ink/90">{out}</div>;
}

/* ------------------------------ charts ------------------------------ */

function Chart({ spec }) {
  const { type = "bar", title, labels = [], datasets = [] } = spec || {};
  if (!labels.length || !datasets.length) return null;
  const W = 560;
  const H = 220;
  const pad = { l: 32, r: 12, t: 12, b: 42 };
  const max = Math.max(1, ...datasets.flatMap((d) => d.values || []));
  const ticks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)))];
  const x0 = pad.l;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const y = (v) => pad.t + ih - (v / max) * ih;
  const slot = iw / labels.length;

  let body;
  if (type === "pie") {
    const vals = datasets[0].values || [];
    const sum = vals.reduce((a, b) => a + b, 0) || 1;
    const starts = vals.map((_, i) => -Math.PI / 2 + (vals.slice(0, i).reduce((a, b) => a + b, 0) / sum) * Math.PI * 2);
    body = (
      <g transform={`translate(${W / 2 - 110}, ${H / 2})`}>
        {vals.map((v, i) => {
          const a0 = starts[i];
          const a1 = a0 + (v / sum) * Math.PI * 2;
          const r = 88;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
          return <path key={i} d={d} fill={COLORS[i % COLORS.length]} stroke="var(--color-panel)" strokeWidth="2" />;
        })}
        <circle r="46" fill="var(--color-panel)" />
        {labels.map((l, i) => (
          <g key={l} transform={`translate(120, ${-80 + i * 20})`}>
            <rect width="10" height="10" rx="3" fill={COLORS[i % COLORS.length]} />
            <text x="16" y="9" fontSize="11" fill="var(--color-muted)">
              {l} · {vals[i]}
            </text>
          </g>
        ))}
      </g>
    );
  } else {
    body = (
      <>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x0} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={x0 - 6} y={y(t) + 3} fontSize="10" textAnchor="end" fill="var(--color-faint)">
              {t}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x0 + slot * i + slot / 2} y={H - pad.b + 16} fontSize="10" textAnchor="middle" fill="var(--color-muted)">
            {String(l).length > 10 ? `${String(l).slice(0, 9)}…` : l}
          </text>
        ))}
        {type === "line"
          ? datasets.map((d, k) => {
              const pts = (d.values || []).map((v, i) => [x0 + slot * i + slot / 2, y(v)]);
              return (
                <g key={k}>
                  <path d={pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ")} fill="none" stroke={colorOf(d, k)} strokeWidth="2" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={colorOf(d, k)}>
                      <title>{`${labels[i]}: ${d.values[i]}`}</title>
                    </circle>
                  ))}
                </g>
              );
            })
          : labels.map((l, i) => {
              const bw = Math.min(28, (slot * 0.7) / datasets.length);
              const start = x0 + slot * i + (slot - bw * datasets.length) / 2;
              return datasets.map((d, k) => {
                const v = d.values?.[i] || 0;
                return (
                  <rect key={`${i}-${k}`} x={start + k * bw} y={y(v)} width={bw - 2} height={Math.max(0, pad.t + ih - y(v))} rx="4" fill={colorOf(d, k)}>
                    <title>{`${l} · ${d.label}: ${v}`}</title>
                  </rect>
                );
              });
            })}
      </>
    );
  }
  return (
    <figure className="my-3 rounded-2xl border border-line bg-panel p-4">
      <figcaption className="mb-2 text-[13px] font-medium">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {body}
      </svg>
      {type !== "pie" && datasets.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
          {datasets.map((d, k) => (
            <span key={d.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf(d, k) }} />
              {d.label}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}

/* ------------------------------ the chat ------------------------------ */

function Orb({ size = 96 }) {
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <span className="amigo-orb absolute inset-0 rounded-full" />
      <span className="absolute inset-[18%] rounded-full bg-[var(--color-panel)]" />
      <Icon name="sparkle" size={size * 0.28} className="relative text-ink" />
    </span>
  );
}

function Table({ columns, rows }) {
  return (
    <div className="my-2 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-panel-2 text-[11px] uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                {c}
              </th>
            ))}
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className="group border-t border-line">
              {r.cells.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "font-medium" : "text-ink/80"} ${typeof c === "number" ? "tabular-nums" : ""}`}>
                  {j === 0 && r.href ? (
                    <Link href={r.href} className="hover:text-brand">
                      {c}
                    </Link>
                  ) : (
                    c
                  )}
                </td>
              ))}
              <td className="pr-2">
                {r.href && (
                  <Link href={r.href} aria-label="Open" className="grid h-6 w-6 place-items-center rounded-md text-faint hover:bg-panel-2 hover:text-ink">
                    <Icon name="arrow" size={12} className="-rotate-45" />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Blocks({ blocks, onAsk }) {
  return blocks.map((b, i) => {
    if (b.type === "text") return <Markdown key={i} text={b.text} />;
    if (b.type === "chart") return <Chart key={i} spec={b.spec} />;
    if (b.type === "table") return <Table key={i} columns={b.columns} rows={b.rows} />;
    if (b.type === "link")
      return (
        <Link key={i} href={b.href} className="btn-ghost btn-sm mt-2">
          {b.label} <Icon name="arrow" size={12} />
        </Link>
      );
    if (b.type === "suggest")
      return (
        <div key={i} className="mt-2 flex flex-wrap gap-1.5">
          {b.items.map((s) => (
            <button key={s} onClick={() => onAsk(s)} className="rounded-full border border-line bg-panel-2 px-3 py-1.5 text-[12px] text-ink/80 hover:text-ink">
              {s}
            </button>
          ))}
        </div>
      );
    return null;
  });
}

function Turn({ m, initials, onAsk }) {
  if (m.role === "user")
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-panel-2 px-4 py-2.5 text-[14px]">{m.text}</div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-panel-3 text-[11px] font-semibold">{initials}</span>
      </div>
    );
  const wide = m.blocks?.some((b) => b.type === "chart" || b.type === "table");
  return (
    <div className="flex gap-3">
      <Orb size={32} />
      <div className={`min-w-0 max-w-[88%] rounded-2xl rounded-tl-md border px-4 py-2.5 ${m.error ? "border-rose-400/30 bg-rose-400/10 text-rose-400" : "border-line bg-panel"} ${wide ? "flex-1" : ""}`}>
        {m.error ? <p className="text-sm">{m.error}</p> : <Blocks blocks={m.blocks || []} onAsk={onAsk} />}
      </div>
    </div>
  );
}

function Library({ questions, onAsk }) {
  return (
    <div className="grid w-full gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
      {questions.map(([group, qs]) => (
        <section key={group} className="rounded-2xl border border-line bg-panel p-3">
          <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{group}</h3>
          <ul className="flex flex-col">
            {qs.map((q) => (
              <li key={q}>
                <button onClick={() => onAsk(q)} className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-ink/80 transition hover:bg-panel-2 hover:text-ink">
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function Amigo({ meId, firstName, initials, questions = [], brands = [], people = [] }) {
  const key = `amigo:v2:${meId}`;
  // Rendered only in the browser (see AmigoLoader), so this device's last conversation can be read up front
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  });
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const end = useRef(null);
  const total = questions.reduce((n, [, qs]) => n + qs.length, 0);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages, key]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function ask(q) {
    const question = String(q || "").trim();
    if (!question || busy) return;
    setShowAll(false);
    setText("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/amigo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await res.json().catch(() => ({ error: "Amigo couldn't answer right now." }));
      setMessages((m) => [...m, data.blocks ? { role: "amigo", blocks: data.blocks } : { role: "amigo", error: data.error || "Amigo couldn't answer right now." }]);
    } catch {
      setMessages((m) => [...m, { role: "amigo", error: "Network issue — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100svh-9.5rem)] min-h-[480px] flex-col md:h-[calc(100svh-13rem)]">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <span className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted">
          <Icon name="sparkle" size={13} className="text-brand" /> Amigo · reads your CRM live · nothing leaves the CRM
        </span>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted hover:text-ink">
              <Icon name="list" size={12} /> {showAll ? "Back to chat" : `All ${total} questions`}
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} disabled={busy} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-muted hover:text-ink">
              <Icon name="refresh" size={12} /> New chat
            </button>
          )}
          {brands.length > 0 && <QuickAssign brands={brands} people={people} label="Assign a task" />}
        </div>
      </div>

      <div className="amigo-grid relative min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-line px-3 py-6 sm:px-8">
        {showAll ? (
          <div className="mx-auto max-w-5xl">
            <p className="mb-3 text-sm text-muted">Ask any of these, or type your own. You can swap in any person’s or brand’s name.</p>
            <Library questions={questions} onAsk={ask} />
          </div>
        ) : !messages.length && !busy ? (
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 py-4 text-center">
            <Orb size={96} />
            <div>
              <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Good to see you, {firstName}</h2>
              <p className="mt-1 text-sm text-muted">I’m Amigo. Ask me anything about the CRM — pick one of the {total} questions below, or type your own.</p>
            </div>
            <Library questions={questions} onAsk={ask} />
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m, i) => (
              <Turn key={i} m={m} initials={initials} onAsk={ask} />
            ))}
            {busy && (
              <div className="flex gap-3">
                <Orb size={32} />
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-line bg-panel px-4 py-2.5 text-sm text-muted">
                  <Icon name="refresh" size={13} className="animate-spin text-brand" /> Checking the CRM…
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="mx-auto mt-3 flex w-full max-w-3xl items-center gap-2 rounded-[22px] border border-line bg-panel p-2 pl-4 shadow-[var(--card-shadow)]"
      >
        <input
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask me anything… e.g. How much work does Riya have pending?"
          className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
        />
        <button disabled={busy || !text.trim()} aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-solid text-on-solid transition disabled:opacity-40">
          <Icon name="arrow" size={16} className="-rotate-90" />
        </button>
      </form>
    </div>
  );
}
