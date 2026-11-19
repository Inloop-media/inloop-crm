// A lead shared in a direct message uses the same fields as a lead in the CRM (New lead form / website),
// so the sales head can publish it as-is. Plain functions, safe on the server and in the browser.

export const LEAD_SOURCES = ["manual", "call", "referral", "whatsapp", "instagram", "linkedin", "event"];

const c = (v, max) => String(v ?? "").trim().slice(0, max);

/** Clean lead fields. Older lead cards had a single `name`; it is split into first / last. */
export function normalizeLead(l = {}) {
  let first = c(l.first_name, 100);
  let last = c(l.last_name, 100);
  if (!first && !last && l.name) {
    const [f, ...rest] = String(l.name).trim().split(/\s+/);
    first = c(f, 100);
    last = c(rest.join(" "), 100);
  }
  return {
    first_name: first,
    last_name: last,
    phone: c(l.phone, 40),
    email: c(l.email, 200),
    brand: c(l.brand, 200),
    location: c(l.location, 200),
    service: c(l.service, 200),
    budget: c(l.budget, 100),
    source: LEAD_SOURCES.includes(l.source) ? l.source : "manual",
    details: c(l.details, 4000),
  };
}

/** Same rule as the New lead form. Returns an error message, or "" when the lead is fine. */
export function leadProblem(l) {
  if (!l.first_name) return "Add the contact's first name.";
  if (!l.phone && !l.email) return "Add a phone number or an email.";
  return "";
}

export const leadName = (l) => [l.first_name, l.last_name].filter(Boolean).join(" ") || l.name || "";
