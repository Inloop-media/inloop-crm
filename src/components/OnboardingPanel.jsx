"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/browser";
import { confirmSigned, markMouSent, reopenMou, saveMou, startOnboarding, startSignedUpload } from "@/app/(crm)/brands/actions";
import { fmtDateTime } from "@/lib/format";

const BILLING = ["Monthly", "One-time", "Per deliverable"];

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn, after) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (res && !res.ok) return setError(res.error || "Something went wrong.");
      after?.(res);
      router.refresh();
    });
  return { pending, error, setError, run };
}

function Field({ label, children, wide }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Lead is Won but no brand yet. */
export function StartOnboarding({ leadId }) {
  const { pending, error, run } = useRun();
  return (
    <div className="tint-green flex flex-wrap items-center gap-4 rounded-2xl p-5">
      <span className="icon-tile">
        <Icon name="sparkle" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">Client closed — start onboarding</div>
        <p className="text-xs text-ink/60">Drafts the MOU from the template with this client&apos;s services.</p>
      </div>
      <button onClick={() => run(() => startOnboarding(leadId))} disabled={pending} className="btn-primary">
        {pending ? "Starting…" : "Draft the MOU"} <Icon name="arrow" size={14} />
      </button>
      {error && <p className="w-full text-xs text-rose-400">{error}</p>}
    </div>
  );
}

/** MOU editor → sent → signed copy back → onboarded. */
export default function OnboardingPanel({ brand }) {
  const { pending, error, setError, run } = useRun();
  const [name, setName] = useState(brand.name);
  const [services, setServices] = useState(brand.services?.length ? brand.services : [{ name: "", scope: "", fee: "", billing: "Monthly" }]);
  const [terms, setTerms] = useState(brand.terms || {});
  const [dirty, setDirty] = useState(false);
  const [progress, setProgress] = useState("");
  const fileRef = useRef(null);
  const sentDocs = brand.docs.filter((d) => d.kind === "mou");
  const signedDocs = brand.docs.filter((d) => d.kind === "mou_signed");
  const latest = sentDocs.at(-1);
  const draft = brand.stage === "mou_draft";

  const t = (k) => terms[k] ?? "";
  const setT = (k) => (e) => {
    setTerms({ ...terms, [k]: e.target.value });
    setDirty(true);
  };
  const setS = (i, k, v) => {
    setServices(services.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
    setDirty(true);
  };
  const save = (after) => run(() => saveMou(brand.id, { name, services, terms }), () => { setDirty(false); after?.(); });

  const uploadSigned = async (file) => {
    setError("");
    setProgress(`Uploading ${file.name}…`);
    const s = await startSignedUpload(brand.id, file.name, file.size, file.type);
    if (!s.ok) {
      setProgress("");
      return setError(s.error);
    }
    const { error: upErr } = await createClient().storage.from("lead-docs").uploadToSignedUrl(s.path, s.token, file, { contentType: file.type || undefined });
    setProgress("");
    if (fileRef.current) fileRef.current.value = "";
    if (upErr) return setError(upErr.message);
    run(() => confirmSigned(brand.id, { path: s.path, name: file.name, size: file.size }));
  };

  if (brand.stage === "active") {
    return (
      <div className="tint-green flex flex-wrap items-center gap-4 rounded-2xl p-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white">
          <Icon name="check" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{brand.name} is onboarded</div>
          <p className="text-xs text-ink/60">MOU signed {fmtDateTime(brand.signed_at)}</p>
        </div>
        {signedDocs.at(-1) && (
          <a href={signedDocs.at(-1).href} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            <Icon name="file" size={13} /> Signed MOU
          </a>
        )}
        <a href={`/brands/${brand.id}`} className="btn-primary btn-sm">
          Open brand <Icon name="arrow" size={13} />
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Step strip */}
      <ol className="grid grid-cols-3 gap-2 text-xs">
        {[
          ["MOU details", draft],
          ["Sent to client", brand.stage === "mou_sent"],
          ["Signed & onboarded", false],
        ].map(([label, on], i) => (
          <li key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${on ? "solid" : i === 0 && !draft ? "tint-green" : "well"}`}>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/25 text-[10px] font-semibold">{i === 0 && !draft ? "✓" : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {draft ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand name (shown everywhere)">
              <input className="field" value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} />
            </Field>
            <Field label="Client company (legal name)">
              <input className="field" value={t("client_legal_name")} onChange={setT("client_legal_name")} />
            </Field>
            <Field label="Signatory name">
              <input className="field" value={t("signatory_name")} onChange={setT("signatory_name")} />
            </Field>
            <Field label="Signatory designation">
              <input className="field" value={t("signatory_title")} onChange={setT("signatory_title")} />
            </Field>
            <Field label="Client login email (dashboard + OTP)">
              <input className="field" type="email" value={t("client_email")} onChange={setT("client_email")} />
            </Field>
            <Field label="Client phone">
              <input className="field" value={t("client_phone")} onChange={setT("client_phone")} />
            </Field>
            <Field label="Client address" wide>
              <input className="field" value={t("client_address")} onChange={setT("client_address")} />
            </Field>
            <Field label="Start date">
              <input className="field" type="date" value={t("start_date")} onChange={setT("start_date")} />
            </Field>
            <Field label="Term (months)">
              <input className="field" inputMode="numeric" value={t("months")} onChange={setT("months")} />
            </Field>
            <Field label="Signing for Inloop (name)">
              <input className="field" value={t("agency_signatory")} onChange={setT("agency_signatory")} />
            </Field>
            <Field label="Designation">
              <input className="field" value={t("agency_title")} onChange={setT("agency_title")} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Services in the MOU</span>
              <span className="text-[11px] text-faint">Pre-filled from the proposal commercials</span>
            </div>
            <div className="flex flex-col gap-2">
              {services.map((s, i) => (
                <div key={i} className="well grid gap-2 p-3 sm:grid-cols-[1.2fr_1.6fr_.8fr_.9fr_auto]">
                  <input className="field bg-panel py-2 text-sm" placeholder="Service, e.g. Social media management" value={s.name} onChange={(e) => setS(i, "name", e.target.value)} />
                  <input className="field bg-panel py-2 text-sm" placeholder="What's included, e.g. 12 posts + 4 reels / month" value={s.scope} onChange={(e) => setS(i, "scope", e.target.value)} />
                  <input className="field bg-panel py-2 text-sm" placeholder="₹45,000" value={s.fee} onChange={(e) => setS(i, "fee", e.target.value)} />
                  <select className="field bg-panel py-2 text-sm" value={s.billing} onChange={(e) => setS(i, "billing", e.target.value)}>
                    {BILLING.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => (setServices(services.filter((_, j) => j !== i)), setDirty(true))}
                    title="Remove"
                    className="grid h-9 w-9 place-items-center self-center rounded-full text-faint hover:bg-panel hover:text-rose-400"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setServices([...services, { name: "", scope: "", fee: "", billing: "Monthly" }])}
              className="mt-2 text-xs font-medium text-muted hover:text-ink"
            >
              + Add service
            </button>
          </div>

          <Field label="Payment terms">
            <textarea className="field resize-y" rows={2} value={t("payment_terms")} onChange={setT("payment_terms")} />
          </Field>
          <Field label="Other terms (optional)">
            <textarea className="field resize-y" rows={2} value={t("notes")} onChange={setT("notes")} />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => save()} disabled={pending || !dirty} className="btn-ghost">
              {dirty ? "Save" : "Saved"}
            </button>
            <a
              href={`/api/mou/${brand.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                if (dirty) {
                  e.preventDefault();
                  setError("Save first, then preview.");
                }
              }}
              className="btn-ghost"
            >
              <Icon name="external" size={14} /> Preview PDF
            </a>
            <button
              onClick={() => (dirty ? save(() => run(() => markMouSent(brand.id))) : run(() => markMouSent(brand.id)))}
              disabled={pending}
              className="btn-primary ml-auto"
            >
              {pending ? "Working…" : "Finalise & mark as sent"} <Icon name="arrow" size={14} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="tint-lavender flex flex-wrap items-center gap-4 rounded-2xl p-5">
            <span className="icon-tile">
              <Icon name="mail" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">MOU v{brand.mou_version} sent — waiting for the signed copy</div>
              <p className="text-xs text-ink/60">
                Sent {fmtDateTime(brand.mou_sent_at)}. Mail this PDF to {brand.terms?.client_email || "the client"}; when the signed copy comes back, upload it here.
              </p>
            </div>
            {latest && (
              <div className="flex gap-2">
                <a href={latest.href} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                  <Icon name="external" size={13} /> Open
                </a>
                <a href={`${latest.href}${latest.href.includes("?") ? "&" : "?"}download=${encodeURIComponent(latest.name)}`} className="btn-ghost btn-sm">
                  <Icon name="upload" size={13} className="rotate-180" /> Download
                </a>
              </div>
            )}
          </div>

          <div className="well flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Client signed?</div>
              <p className="text-xs text-muted">Upload the signed MOU (PDF or photo). The brand is onboarded and everyone sees the welcome.</p>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf,image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSigned(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={pending || Boolean(progress)} className="btn-primary">
              <Icon name="upload" size={14} /> {progress ? "Uploading…" : pending ? "Onboarding…" : "Upload signed MOU"}
            </button>
            <button onClick={() => run(() => reopenMou(brand.id))} disabled={pending} className="px-1 text-xs text-muted hover:text-ink">
              Edit the MOU again
            </button>
          </div>
        </>
      )}
      {progress && <p className="text-xs text-muted">{progress}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
