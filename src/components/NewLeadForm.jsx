"use client";
// New lead: the form on the left in two compact cards (Contact, Project), and on the right a live card
// of the lead as it will look, with the Add button — so the whole thing fits on one screen.
import { useActionState, useState } from "react";
import Icon from "@/components/Icon";
import { BrandMark, Avatar } from "@/components/ui";
import { createLead } from "@/app/(crm)/actions";
import { BUDGETS, SERVICES } from "@/lib/constants";
import { LEAD_SOURCES as SOURCES } from "@/lib/leadShare";

function Field({ id, label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-medium text-muted" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${on ? "bg-solid text-on-solid" : "bg-panel-2 text-muted hover:text-ink"} ${className}`}
    >
      {children}
    </button>
  );
}

function CardTitle({ icon, children, note }) {
  return (
    <header className="mb-4 flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-panel-2 text-muted">
        <Icon name={icon} size={15} />
      </span>
      <h2 className="text-[15px] font-medium">{children}</h2>
      {note && <span className="ml-auto text-[11.5px] text-faint">{note}</span>}
    </header>
  );
}

function PreviewRow({ icon, children, empty }) {
  return (
    <li className="flex items-center gap-2.5 py-2 text-[13px]">
      <Icon name={icon} size={14} className="shrink-0 text-faint" />
      {children ? <span className="min-w-0 truncate">{children}</span> : <span className="text-faint">{empty}</span>}
    </li>
  );
}

export default function NewLeadForm({ members }) {
  const [state, action, pending] = useActionState(createLead, {});
  const [f, setF] = useState({ first_name: "", last_name: "", phone: "", email: "", brand: "", location: "", service: "", budget: "", source: "manual", assigned_to: "" });
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  // Tapping the picked budget again clears it; the source always has one picked
  const pick = (k, val) => setF((v) => ({ ...v, [k]: v[k] === val && k !== "source" ? "" : val }));
  const person = [f.first_name, f.last_name].filter(Boolean).join(" ");
  const title = f.brand || person || "New lead";
  const owner = members.find((m) => m.id === f.assigned_to);

  return (
    <form action={action} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className="rise rise-1 card p-5 sm:p-6">
          <CardTitle icon="team" note="* needed">
            Contact
          </CardTitle>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field id="first_name" label="First name *">
              <input id="first_name" name="first_name" required className="field" value={f.first_name} onChange={set("first_name")} placeholder="Riya" />
            </Field>
            <Field id="last_name" label="Last name">
              <input id="last_name" name="last_name" className="field" value={f.last_name} onChange={set("last_name")} placeholder="Kapoor" />
            </Field>
            <Field id="brand" label="Brand name">
              <input id="brand" name="brand" className="field" value={f.brand} onChange={set("brand")} placeholder="Glow Co" />
            </Field>
            <Field id="phone" label="Contact number">
              <input id="phone" name="phone" type="tel" className="field" value={f.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
            </Field>
            <Field id="email" label="Email">
              <input id="email" name="email" type="email" className="field" value={f.email} onChange={set("email")} placeholder="riya@glowco.in" />
            </Field>
            <Field id="location" label="Location">
              <input id="location" name="location" className="field" value={f.location} onChange={set("location")} placeholder="Mumbai" />
            </Field>
          </div>
        </section>

        <section className="rise rise-2 card p-5 sm:p-6">
          <CardTitle icon="brief">Project</CardTitle>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <Field id="service" label="Service interest">
              <select id="service" name="service" className="field" value={f.service} onChange={set("service")}>
                <option value="">—</option>
                {SERVICES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field id="assigned_to" label="Assign to">
              <select id="assigned_to" name="assigned_to" className="field" value={f.assigned_to} onChange={set("assigned_to")}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[12px] font-medium text-muted">Estimated budget</span>
              <input type="hidden" name="budget" value={f.budget} />
              <div className="flex flex-wrap gap-1.5">
                {BUDGETS.map((b) => (
                  <Chip key={b} on={f.budget === b} onClick={() => pick("budget", b)}>
                    {b}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[12px] font-medium text-muted">Source</span>
              <input type="hidden" name="source" value={f.source} />
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.map((s) => (
                  <Chip key={s} on={f.source === s} onClick={() => pick("source", s)} className="capitalize">
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <Field id="details" label="Project details" className="sm:col-span-2">
              <textarea id="details" name="details" rows={3} className="field resize-y" placeholder="What they need, timelines, anything they said on the call…" />
            </Field>
          </div>
        </section>
      </div>

      {/* The lead as it will look, and the button */}
      <aside className="rise rise-3 flex flex-col gap-3 lg:sticky lg:top-4">
        <div className="card overflow-hidden !p-0">
          <div className="relative h-20 bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_srgb,var(--color-brand)_22%,transparent),transparent_60%),var(--color-panel-2)]">
            <span className="absolute right-3 top-3 rounded-full bg-panel/80 px-2 py-0.5 text-[10.5px] font-medium text-muted backdrop-blur">New lead preview</span>
          </div>
          <div className="px-5 pb-5">
            <div className="-mt-7 flex items-end gap-3">
              <span className="rounded-[16px] bg-panel p-1 shadow-[var(--card-shadow)]">
                <BrandMark name={title} size={48} />
              </span>
            </div>
            <div className="mt-3">
              <div className="truncate text-[17px] font-medium">{title}</div>
              <div className="truncate text-[12.5px] text-muted">{f.brand && person ? [person, f.location].filter(Boolean).join(" · ") : f.location || "Fill the form — this card updates as you type"}</div>
            </div>
            <ul className="mt-3 divide-y divide-line border-t border-line">
              <PreviewRow icon="phone" empty="No number yet">
                {f.phone}
              </PreviewRow>
              <PreviewRow icon="mail" empty="No email yet">
                {f.email}
              </PreviewRow>
              <PreviewRow icon="sparkle" empty="Service not picked">
                {f.service}
              </PreviewRow>
              <PreviewRow icon="rupee" empty="Budget not picked">
                {f.budget}
              </PreviewRow>
              <li className="flex items-center gap-2.5 py-2 text-[13px]">
                {owner ? <Avatar name={owner.name} size={20} /> : <Icon name="team" size={14} className="shrink-0 text-faint" />}
                {owner ? <span className="truncate">{owner.name}</span> : <span className="text-faint">Unassigned</span>}
                <span className="ml-auto shrink-0 rounded-full bg-panel-2 px-2 py-0.5 text-[11px] capitalize text-muted">{f.source}</span>
              </li>
            </ul>
          </div>
        </div>
        <button disabled={pending} className="btn-primary w-full justify-center py-3">
          {pending ? "Adding…" : "Add lead"} <Icon name="arrow" size={13} />
        </button>
        {state?.error && <p className="text-center text-sm text-rose-400">{state.error}</p>}
        <p className="px-2 text-center text-[11.5px] leading-relaxed text-faint">It gets the next IM- number, same as website leads.</p>
      </aside>
    </form>
  );
}
