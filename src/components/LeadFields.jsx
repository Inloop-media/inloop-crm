"use client";
// The lead fields exactly as on the New lead form, controlled: used when a sales executive shares a lead
// in a direct message and when the sales head checks it before publishing.
import { BUDGETS, SERVICES } from "@/lib/constants";
import { LEAD_SOURCES } from "@/lib/leadShare";

export default function LeadFields({ value, onChange, autoFocus = false }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const input = (k, label, props = {}) => (
    <div>
      <label className="label" htmlFor={`lf-${k}`}>{label}</label>
      <input id={`lf-${k}`} className="field" value={value[k] || ""} onChange={set(k)} {...props} />
    </div>
  );
  return (
    <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted sm:col-span-2">Contact</div>
      {input("first_name", "First name *", { autoFocus, required: true })}
      {input("last_name", "Last name")}
      {input("phone", "Contact number", { type: "tel", inputMode: "tel" })}
      {input("email", "Email", { type: "email" })}
      {input("brand", "Brand name")}
      {input("location", "Location")}
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted sm:col-span-2">Project</div>
      <div>
        <label className="label" htmlFor="lf-service">Service interest</label>
        <select id="lf-service" className="field" value={value.service || ""} onChange={set("service")}>
          <option value="">—</option>
          {value.service && !SERVICES.includes(value.service) && <option>{value.service}</option>}
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="lf-budget">Estimated budget</label>
        <select id="lf-budget" className="field" value={value.budget || ""} onChange={set("budget")}>
          <option value="">—</option>
          {value.budget && !BUDGETS.includes(value.budget) && <option>{value.budget}</option>}
          {BUDGETS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="lf-source">Source</label>
        <select id="lf-source" className="field capitalize" value={value.source || "manual"} onChange={set("source")}>
          {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="lf-details">Project details</label>
        <textarea id="lf-details" rows={3} className="field resize-y" value={value.details || ""} onChange={set("details")} />
      </div>
    </div>
  );
}
