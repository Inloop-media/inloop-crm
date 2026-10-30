"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/browser";
import { DOC_KINDS, PROPOSAL_STAGES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { addDocument, pickUpBrief, removeDocument, retryStep, saveCommercials, startUpload, submitForCrl } from "@/app/(crm)/briefs/actions";

const EDITABLE = ["picked_up", "crl_failed"];
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (res && !res.ok) setError(res.error || "Something went wrong.");
      else router.refresh();
    });
  return { pending, error, run, setError };
}

/* ------------------------------ Documents ------------------------------ */

function DocSlot({ leadId, def, docs, editable }) {
  const fileRef = useRef(null);
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [progress, setProgress] = useState("");
  const { pending, error, run, setError } = useAction();
  const done = docs.length > 0;

  const upload = async (files) => {
    setError("");
    let failed = false;
    const fail = (msg) => {
      failed = true;
      setError(msg);
    };
    for (const file of files) {
      setProgress(`Uploading ${file.name}…`);
      const s = await startUpload(leadId, def.id, file.name, file.size, file.type);
      if (!s.ok) {
        fail(s.error);
        break;
      }
      const { error: upErr } = await createClient().storage.from("lead-docs").uploadToSignedUrl(s.path, s.token, file, { contentType: file.type || undefined });
      if (upErr) {
        fail(upErr.message);
        break;
      }
      const r = await addDocument(leadId, def.id, { path: s.path, name: file.name, size: file.size });
      if (!r.ok) {
        fail(r.error);
        break;
      }
    }
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
    if (!failed) run(async () => ({ ok: true }));
  };

  return (
    <div className={`rounded-2xl p-4 transition ${done ? "tint-green" : "well"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done ? "bg-emerald-500 text-white" : "bg-panel text-muted shadow-[var(--card-shadow)]"}`}>
          <Icon name={done ? "check" : "file"} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {def.label}
            {def.pdf && <span className="rounded-full bg-panel px-1.5 py-0.5 text-[10px] font-medium text-muted">PDF</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted">{def.help}</p>

          {docs.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-xl bg-panel px-3 py-2 text-xs shadow-[var(--card-shadow)]">
                  <Icon name={d.storage_path ? "file" : "link"} size={13} className="text-muted" />
                  <a href={d.href} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-brand">
                    {d.name}
                  </a>
                  {d.size > 0 && <span className="shrink-0 text-faint">{kb(d.size)}</span>}
                  {editable && (
                    <button
                      onClick={() => run(() => removeDocument(d.id))}
                      disabled={pending}
                      title="Remove"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-faint hover:bg-panel-2 hover:text-rose-400"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {editable && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple={!def.pdf}
                accept={def.pdf ? "application/pdf,.pdf" : undefined}
                className="hidden"
                onChange={(e) => e.target.files?.length && upload([...e.target.files])}
              />
              <button onClick={() => fileRef.current?.click()} disabled={Boolean(progress) || pending} className="btn-ghost btn-sm">
                <Icon name="upload" size={13} /> {progress ? "Uploading…" : "Upload file"}
              </button>
              {!def.pdf && (
                <button onClick={() => setShowLink((v) => !v)} className="px-1 text-xs text-muted hover:text-ink">
                  or add a link
                </button>
              )}
            </div>
          )}
          {editable && showLink && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await addDocument(leadId, def.id, { url: link });
                  if (r.ok) {
                    setLink("");
                    setShowLink(false);
                  }
                  return r;
                });
              }}
            >
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" className="field bg-panel py-2 text-xs" />
              <button disabled={!link || pending} className="btn-primary btn-sm shrink-0">
                Add
              </button>
            </form>
          )}
          {progress && <p className="mt-2 text-xs text-muted">{progress}</p>}
          {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Outputs ------------------------------ */

function Deliverable({ label, href, note, icon = "external" }) {
  const ready = Boolean(href);
  return (
    <a
      href={ready ? href : undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-2xl p-4 transition duration-200 ${ready ? "tint-lavender hover:-translate-y-0.5" : "well-empty pointer-events-none"}`}
    >
      <span className={ready ? "icon-tile" : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-faint"}>
        <Icon name={ready ? icon : "clock"} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${ready ? "" : "text-muted"}`}>{label}</div>
        <div className="truncate text-xs text-faint">{ready ? href.replace(/^https?:\/\//, "").split("?")[0] : note}</div>
      </div>
      {ready && <Icon name="external" size={14} className="shrink-0 text-muted" />}
    </a>
  );
}

/* ------------------------------ Main ------------------------------ */

export default function ProposalWorkspace({ proposal: p, canPick, canWork, canCommercials }) {
  const stage = PROPOSAL_STAGES[p.stage] || PROPOSAL_STAGES.brief_shared;
  const editable = canWork && EDITABLE.includes(p.stage);
  const inputs = DOC_KINDS.map((def) => ({ def, docs: p.docs.filter((d) => d.kind === def.id) }));
  const ready = inputs.every((x) => x.docs.length);
  const outputs = p.docs.filter((d) => d.kind === "output");
  const job = p.jobs[0];
  const busy = /queued|running/.test(p.stage);
  const { pending, error, run } = useAction();
  const [commercials, setCommercials] = useState(p.commercials || "");

  return (
    <div className="flex flex-col gap-5">
      {/* Status line */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 text-sm ${stage.error ? "tint-pink" : p.stage === "awaiting_commercials" ? "tint-amber" : "well"}`}
      >
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${stage.error ? "bg-rose-500 text-white" : "icon-tile"}`}>
          <Icon name={stage.error ? "alert" : p.stage === "awaiting_commercials" ? "rupee" : p.stage === "done" ? "check" : "sparkle"} size={16} className={busy ? "animate-pulse" : ""} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{stage.label}</div>
          <div className="mt-0.5 text-xs text-ink/60">
            {p.stage === "brief_shared" && "Waiting for a creative strategist to pick this brief up."}
            {p.stage === "picked_up" && `${p.strategist?.name || "The strategist"} is collecting the 4 documents.`}
            {p.stage === "crl_queued" && "Waiting for the Mac worker to pick it up — it runs when the Mac is on."}
            {p.stage === "crl_running" && (job?.progress || "The CRL bot is downloading the references and building the page.")}
            {p.stage === "awaiting_commercials" && "CRL is ready. An admin needs to enter the commercials for the proposal deck."}
            {p.stage === "proposal_queued" && "Waiting for the Mac worker to pick up the proposal job."}
            {p.stage === "proposal_running" && (job?.progress || "The proposal bot is building the deck.")}
            {p.stage === "done" && `Delivered ${fmtDateTime(p.done_at)}.`}
            {stage.error && (p.error || "The bot reported an error.")}
          </div>
        </div>
        {canPick && (
          <button onClick={() => run(() => pickUpBrief(p.lead_id))} disabled={pending} className="btn-primary">
            {pending ? "Picking up…" : "Pick up this brief"}
          </button>
        )}
        {stage.error && (p.stage === "crl_failed" ? canWork : canCommercials) && (
          <button onClick={() => run(() => retryStep(p.lead_id))} disabled={pending} className="btn-ghost">
            Retry
          </button>
        )}
      </div>

      {/* Documents */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            Documents <span className="code">{inputs.filter((x) => x.docs.length).length}/4</span>
          </h3>
          {editable && (
            <button onClick={() => run(() => submitForCrl(p.lead_id))} disabled={!ready || pending} className="btn-primary">
              <Icon name="sparkle" size={14} />
              {pending ? "Sending…" : p.stage === "crl_failed" ? "Send to CRL bot again" : "Send to CRL bot"}
            </button>
          )}
        </div>
        {!canWork && p.docs.filter((d) => d.kind !== "output").length === 0 ? (
          <p className="well-empty px-4 py-6 text-center text-sm text-muted">No documents yet.</p>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {inputs.map(({ def, docs }) => (
              <DocSlot key={def.id} leadId={p.lead_id} def={def} docs={docs} editable={editable} />
            ))}
          </div>
        )}
        {editable && !ready && <p className="mt-2 text-xs text-muted">All 4 are needed before the CRL bot can start.</p>}
      </section>

      {/* Commercials */}
      {(p.commercials || (canCommercials && ["awaiting_commercials", "proposal_failed"].includes(p.stage))) && (
        <section className="tint-amber rounded-2xl p-5">
          <h3 className="flex items-center gap-2.5 text-sm font-medium">
            <span className="icon-tile h-8 w-8 rounded-lg"><Icon name="rupee" size={14} /></span> Commercials
          </h3>
          {canCommercials && ["awaiting_commercials", "proposal_failed"].includes(p.stage) ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => saveCommercials(p.lead_id, commercials));
              }}
            >
              <textarea
                rows={5}
                value={commercials}
                onChange={(e) => setCommercials(e.target.value)}
                placeholder={"Retainer: ₹1,50,000 / month\nScope: 12 reels, 8 statics, 2 shoots…\nPayment terms: 50% advance"}
                className="field resize-y bg-panel"
              />
              <div className="mt-2 flex items-center gap-3">
                <button disabled={!commercials.trim() || pending} className="btn-primary">
                  {pending ? "Starting…" : "Save & build proposal"}
                </button>
                <span className="text-xs text-ink/60">The proposal bot starts as soon as these are saved.</span>
              </div>
            </form>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink/85">{canCommercials ? p.commercials : "Entered by the admin."}</p>
          )}
        </section>
      )}

      {/* Deliverables */}
      <section>
        <h3 className="mb-3 text-sm font-medium">Deliverables</h3>
        <div className="grid gap-2.5 md:grid-cols-2">
          <Deliverable label="CRL" href={p.crl_url} note="Built from the reference links + identity" />
          <Deliverable label="Proposal deck" href={p.deck_url} note="After the CRL + commercials" icon="sparkle" />
        </div>
        {outputs.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {outputs.map((d) => (
              <li key={d.id}>
                <a href={d.href} target="_blank" rel="noreferrer" className="well flex items-center gap-2 px-3.5 py-2.5 text-xs transition hover:bg-panel-3">
                  <Icon name="file" size={13} className="text-muted" />
                  <span className="min-w-0 flex-1 truncate">{d.name}</span>
                  {d.size > 0 && <span className="text-faint">{kb(d.size)}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}
