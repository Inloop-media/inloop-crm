"use client";
// Bots tab → CRL bot, on its own (no lead): brand name + the two PDFs → the Mac worker downloads the
// references, builds the CRL page and publishes it → the live link shows up here (and as a notification).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import FileDrop from "@/components/FileDrop";
import { createClient } from "@/lib/supabase/browser";
import { botUploadUrl, deleteBotRun, retryBotRun, startCrl } from "@/app/(crm)/bots/actions";

const SLOTS = [
  { key: "identity", label: "Brand identity PDF", hint: "Logo, colours, fonts" },
  { key: "content", label: "Content reference PDF", hint: "The reference links" },
];
const isPdf = (f) => /\.pdf$/i.test(f?.name || "") || f?.type === "application/pdf";
const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Slot({ slot, file, onPick, disabled }) {
  const input = useRef(null);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => input.current?.click()}
      className={`flex min-w-0 items-center gap-3 rounded-2xl border border-dashed p-3.5 text-left transition ${file ? "border-emerald-500/50 bg-emerald-500/5" : "border-line hover:border-brand/60"}`}
    >
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onPick(f);
      }} />
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${file ? "bg-emerald-500/15 text-emerald-500" : "bg-panel-2 text-muted"}`}>
        <Icon name={file ? "check" : "file"} size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{slot.label}</span>
        <span className="block truncate text-[12px] text-muted">{file ? file.name : `${slot.hint} · click or drop`}</span>
      </span>
    </button>
  );
}

function Copy({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-ghost btn-sm" onClick={async () => {
      await navigator.clipboard.writeText(text).catch(() => {});
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }}>
      {done ? "Copied" : "Copy link"}
    </button>
  );
}

function Run({ run }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const act = async (fn) => {
    setBusy(true);
    const r = await fn(run.id);
    setBusy(false);
    if (!r.ok) alert(r.error);
    router.refresh();
  };
  const tone = { done: "text-emerald-500", failed: "text-rose-400", running: "text-amber-500", queued: "text-muted" }[run.status];
  const label = { done: "Ready", failed: "Failed", running: "Building", queued: "Waiting" }[run.status];
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium">{run.name}</span>
          <span className={`text-[11.5px] font-medium ${tone}`}>{label}</span>
        </div>
        {run.status === "done" && run.result_url && (
          <a href={run.result_url} target="_blank" rel="noreferrer" className="block truncate text-[12.5px] text-brand hover:underline">
            {run.result_url}
          </a>
        )}
        {run.status === "running" && <div className="truncate text-[12px] text-ink/80">{run.progress || "Working…"}</div>}
        {run.status === "failed" && <div className="text-[12px] text-rose-400">{run.error}</div>}
        {run.stale && <div className="text-[12px] text-amber-500">Nobody has picked this up — start the CRM worker on the Mac (start-crm-worker.command).</div>}
        <div className="mt-0.5 text-[11px] text-faint">
          {when(run.created_at)}
          {run.by?.name ? ` · ${run.by.name}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {run.status === "done" && run.result_url && (
          <>
            <Copy text={run.result_url} />
            <a href={run.result_url} target="_blank" rel="noreferrer" className="btn-primary btn-sm">
              Open <Icon name="external" size={12} />
            </a>
          </>
        )}
        {run.status === "failed" && (
          <button type="button" disabled={busy} onClick={() => act(retryBotRun)} className="btn-primary btn-sm">
            <Icon name="refresh" size={12} /> Try again
          </button>
        )}
        {run.status !== "running" && (
          <button type="button" disabled={busy} onClick={() => confirm(`Remove "${run.name}" from this list? The CRL link keeps working.`) && act(deleteBotRun)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-rose-400" aria-label="Remove">
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
    </li>
  );
}

export default function CrlBot({ runs }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [files, setFiles] = useState({ identity: null, content: null });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const active = runs.some((r) => r.status === "queued" || r.status === "running");

  // While something is building, check every 15s too (in case a live ping is missed)
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 15e3);
    return () => clearInterval(t);
  }, [active, router]);

  const pick = (key, f) => {
    setError("");
    if (!isPdf(f)) return setError("Only PDFs — upload the brand identity and the content reference as PDF.");
    setFiles((s) => ({ ...s, [key]: f }));
  };
  // Dropping files on the page: names with identity / content go to their box, otherwise fill the empty ones
  const drop = (list) => {
    const pdfs = list.filter(isPdf);
    if (!pdfs.length) return setError("Only PDFs.");
    setError("");
    setFiles((s) => {
      const next = { ...s };
      const rest = [];
      for (const f of pdfs) {
        if (/identity|brand[_\s-]?id/i.test(f.name)) next.identity = f;
        else if (/content|reference|ref/i.test(f.name)) next.content = f;
        else rest.push(f);
      }
      for (const f of rest) {
        if (!next.identity) next.identity = f;
        else if (!next.content) next.content = f;
      }
      return next;
    });
    if (!name) {
      const guess = pdfs[0].name.replace(/\.pdf$/i, "").split(/[_\-]+(brand|content|identity|reference)/i)[0].replace(/[_\-]+/g, " ").trim();
      if (guess) setName(guess);
    }
  };

  const go = async () => {
    setError("");
    if (!name.trim()) return setError("Write the brand name.");
    if (!files.identity || !files.content) return setError("Add both PDFs.");
    const paths = {};
    for (const slot of SLOTS) {
      const f = files[slot.key];
      setStatus(`Uploading ${slot.label}…`);
      const u = await botUploadUrl(f.name, f.size);
      if (!u.ok) {
        setStatus("");
        return setError(u.error);
      }
      const { error: up } = await createClient().storage.from("lead-docs").uploadToSignedUrl(u.path, u.token, f, { contentType: "application/pdf" });
      if (up) {
        setStatus("");
        return setError(`${slot.label} didn't upload: ${up.message}`);
      }
      paths[slot.key] = u.path;
    }
    setStatus("Starting the bot…");
    const r = await startCrl({ name, ...paths });
    setStatus("");
    if (!r.ok) return setError(r.error);
    setName("");
    setFiles({ identity: null, content: null });
    router.refresh();
  };

  const busy = Boolean(status);
  return (
    <div className="flex flex-col gap-5">
      <FileDrop enabled={!busy} onFiles={drop} label="Drop the two PDFs" hint="Brand identity + content reference" />
      <section className="card rise flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
            <Icon name="sparkle" size={19} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-medium">CRL bot</div>
            <div className="text-[12.5px] text-muted">Upload the two PDFs — it downloads the references, builds the CRL page and gives you the link. Not linked to any lead.</div>
          </div>
        </div>
        <input className="field" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name, e.g. Barosi" disabled={busy} />
        <div className="grid gap-3 sm:grid-cols-2">
          {SLOTS.map((s) => (
            <Slot key={s.key} slot={s} file={files[s.key]} onPick={(f) => pick(s.key, f)} disabled={busy} />
          ))}
        </div>
        {error && <p className="rounded-xl bg-rose-400/10 px-3 py-2 text-[12.5px] text-rose-400">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="button" onClick={go} disabled={busy || !name.trim() || !files.identity || !files.content} className="btn-primary">
            {status || "Make the CRL"}
          </button>
          <span className="text-[12px] text-faint">Takes a few minutes — runs on the Mac worker.</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-medium text-muted">Recent CRLs</h2>
        {runs.length ? (
          <ul className="flex flex-col gap-2">
            {runs.map((r) => (
              <Run key={r.id} run={r} />
            ))}
          </ul>
        ) : (
          <p className="card p-5 text-[13px] text-muted">No CRLs made here yet.</p>
        )}
      </section>
    </div>
  );
}
