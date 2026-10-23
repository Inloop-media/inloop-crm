"use client";

import { useActionState } from "react";
import { createLead } from "@/app/(crm)/actions";
import { BUDGETS, SERVICES } from "@/lib/constants";

const SOURCES = ["manual", "call", "referral", "whatsapp", "instagram", "linkedin", "event"];

export default function NewLeadForm({ members }) {
  const [state, action, pending] = useActionState(createLead, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="first_name">First name *</label>
        <input id="first_name" name="first_name" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="last_name">Last name</label>
        <input id="last_name" name="last_name" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Contact number</label>
        <input id="phone" name="phone" type="tel" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="brand">Brand name</label>
        <input id="brand" name="brand" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="location">Location</label>
        <input id="location" name="location" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="service">Service interest</label>
        <select id="service" name="service" className="field" defaultValue="">
          <option value="">—</option>
          {SERVICES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="budget">Estimated budget</label>
        <select id="budget" name="budget" className="field" defaultValue="">
          <option value="">—</option>
          {BUDGETS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="source">Source</label>
        <select id="source" name="source" className="field capitalize" defaultValue="manual">
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="assigned_to">Assign to</label>
        <select id="assigned_to" name="assigned_to" className="field" defaultValue="">
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="details">Project details</label>
        <textarea id="details" name="details" rows={4} className="field resize-y" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn-primary">{pending ? "Adding…" : "Add lead"}</button>
        {state?.error && <span className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}
