import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// The MOU: Inloop's standard template + this client's services and terms → a PDF.
// The template text lives here until the real one replaces it; the client fills only the signature box.

export const DEFAULT_TERMS = {
  client_legal_name: "",
  client_address: "",
  signatory_name: "",
  signatory_title: "Founder",
  client_email: "",
  client_phone: "",
  start_date: "",
  months: "3",
  payment_terms: "Monthly fees are invoiced at the start of each month and payable within 7 days of the invoice.",
  agency_signatory: "",
  agency_title: "Director",
  notes: "",
};

export const BILLING = ["Monthly", "One-time", "Per deliverable"];

/** Best guess at service rows from the free-text commercials the admin typed for the proposal. */
export function servicesFromCommercials(text) {
  const rows = [];
  for (const raw of String(text || "").split(/\n+/)) {
    const line = raw.replace(/^[\s•*\-–\d.)]+/, "").trim();
    if (!line || /^(gst|total|note|ad spend)/i.test(line)) continue;
    const money = line.match(/(₹|rs\.?|inr)\s*[\d,]+(\.\d+)?\s*(k|lakh|l)?/i) || line.match(/[\d,]{4,}/);
    if (!money) continue;
    const name = line.slice(0, money.index).replace(/[\s:—–\-=|]+$/, "").trim() || line;
    const billing = /one[\s-]?time/i.test(line) ? "One-time" : /per (post|reel|video|deliverable)/i.test(line) ? "Per deliverable" : "Monthly";
    rows.push({ name: name.slice(0, 120), scope: "", fee: money[0].trim(), billing });
  }
  return rows.slice(0, 12);
}

/* ------------------------------- PDF ------------------------------- */

const W = 595.28;
const H = 841.89;
const M = 56;
const INK = rgb(0.09, 0.09, 0.12);
const MUTED = rgb(0.38, 0.38, 0.44);
const LINE = rgb(0.85, 0.85, 0.88);
const BRAND = rgb(0.36, 0.33, 0.85);

// The standard PDF fonts only cover Latin-1 (+ a few typographic marks): spell out ₹ and drop the rest
const SAFE_EXTRA = "–—‘’“”•…€";
const clean = (s) =>
  String(s ?? "")
    .replace(/₹\s*/g, "INR ")
    .replace(/[‐-‒]/g, "-")
    .replace(/\t/g, "  ")
    .split("")
    .filter((c) => c === "\n" || (c >= " " && c.charCodeAt(0) <= 0xff) || SAFE_EXTRA.includes(c))
    .join("");

const blank = (v, width = 28) => clean(v).trim() || "_".repeat(width);

const fmtDate = (d) => {
  const t = d ? new Date(d) : new Date();
  if (Number.isNaN(t.getTime())) return clean(d);
  return t.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
};

/**
 * @param brand { name, services, terms, mou_version }
 * @param lead  { code, email, phone, brand, first_name, last_name, location }
 * @param crmUrl where the client dashboard lives
 * @returns Uint8Array (PDF)
 */
export async function buildMouPdf({ brand, lead, crmUrl }) {
  const t = { ...DEFAULT_TERMS, ...(brand.terms || {}) };
  const services = (brand.services || []).filter((s) => s.name);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`MOU — ${brand.name} x Inloop Media`);
  pdf.setAuthor("Inloop Media");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page;
  let y;
  let pageNo = 0;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    pageNo += 1;
    y = H - M;
    page.drawText("INLOOP MEDIA", { x: M, y: H - 34, size: 8, font: bold, color: BRAND });
    page.drawText(clean(`MOU · ${brand.name} · ${lead.code}`), { x: W - M - regular.widthOfTextAtSize(clean(`MOU · ${brand.name} · ${lead.code}`), 8), y: H - 34, size: 8, font: regular, color: MUTED });
    page.drawText(String(pageNo), { x: W / 2 - 3, y: 28, size: 8, font: regular, color: MUTED });
  };
  const ensure = (h) => {
    if (y - h < M + 10) newPage();
  };
  const wrap = (text, font, size, width) => {
    const out = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > width && line) {
          out.push(line);
          line = word;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  };
  const para = (text, { size = 10, font = regular, color = INK, gap = 8, indent = 0, lead: lh = 1.45 } = {}) => {
    const lines = wrap(text, font, size, W - 2 * M - indent);
    for (const l of lines) {
      ensure(size * lh);
      page.drawText(l, { x: M + indent, y: y - size, size, font, color });
      y -= size * lh;
    }
    y -= gap;
  };
  const heading = (n, title) => {
    ensure(40);
    y -= 6;
    page.drawText(clean(`${n}. ${title}`.toUpperCase()), { x: M, y: y - 11, size: 10.5, font: bold, color: INK });
    y -= 22;
  };

  newPage();
  y -= 18;
  page.drawText("MEMORANDUM OF UNDERSTANDING", { x: M, y: y - 20, size: 20, font: bold, color: INK });
  y -= 32;
  para(`${brand.name} × Inloop Media`, { size: 12, color: BRAND, font: bold, gap: 2 });
  para(`Reference ${lead.code}${brand.mou_version > 1 ? ` · version ${brand.mou_version}` : ""} · ${fmtDate()}`, { size: 9, color: MUTED, gap: 16 });

  para(
    `This Memorandum of Understanding ("MOU") is made on ${fmtDate()} between Inloop Media ("Inloop" or "the Agency") and ` +
      `${blank(t.client_legal_name || brand.name)}${t.client_address ? `, ${clean(t.client_address)}` : ""} ("the Client"), ` +
      `represented by ${blank(t.signatory_name || [lead.first_name, lead.last_name].filter(Boolean).join(" "))}` +
      `${t.signatory_title ? `, ${clean(t.signatory_title)}` : ""}.`,
    { gap: 6 }
  );
  para("It records the services Inloop will deliver, the fees, and how both sides will work together.", { gap: 10 });

  heading(1, "Scope of services");
  if (!services.length) para("Services to be listed.", { color: MUTED });
  else {
    const cols = [{ w: 22, k: "#" }, { w: 170, k: "Service" }, { w: 160, k: "What's included" }, { w: 75, k: "Fee" }, { w: W - 2 * M - 22 - 170 - 160 - 75, k: "Billing" }];
    ensure(24);
    let x = M;
    page.drawRectangle({ x: M, y: y - 18, width: W - 2 * M, height: 18, color: rgb(0.95, 0.95, 0.98) });
    for (const c of cols) {
      page.drawText(c.k, { x: x + 5, y: y - 12.5, size: 8.5, font: bold, color: MUTED });
      x += c.w;
    }
    y -= 18;
    services.forEach((s, i) => {
      const cells = [String(i + 1), s.name, s.scope || "", s.fee || "", s.billing || ""];
      const wrapped = cells.map((c, ci) => wrap(c, ci === 1 ? bold : regular, 9, cols[ci].w - 10));
      const h = Math.max(...wrapped.map((w) => w.length)) * 12.5 + 10;
      ensure(h);
      let cx = M;
      wrapped.forEach((lines, ci) => {
        lines.forEach((l, li) => page.drawText(l, { x: cx + 5, y: y - 15 - li * 12.5, size: 9, font: ci === 1 ? bold : regular, color: INK }));
        cx += cols[ci].w;
      });
      y -= h;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
    });
    y -= 12;
  }
  para("All fees are exclusive of GST (18%), which is added to every invoice. Advertising spend on Meta, Google or any other platform is not part of the fees — it is paid by the Client directly or billed separately at actuals.", { size: 9, color: MUTED, gap: 4 });

  heading(2, "Term");
  para(
    `The engagement starts on ${t.start_date ? fmtDate(t.start_date) : "the date this MOU is signed"} and runs for ${clean(t.months) || "3"} month(s). ` +
      "It continues month to month after that unless either side gives 30 days' written notice."
  );

  heading(3, "Fees and payment");
  para(clean(t.payment_terms) || DEFAULT_TERMS.payment_terms);
  para("Work on a new month starts once that month's invoice is paid. One-time fees are payable 50% in advance and 50% on delivery unless agreed otherwise in writing.");

  heading(4, "Approvals and revisions");
  para(
    "Inloop shares every deliverable (posts, reels, videos, designs, pages) on the Client's Inloop dashboard for approval. " +
      "The Client approves it or asks for changes with a short note, ideally within 2 working days, so the content calendar stays on time. " +
      "Each deliverable includes up to 2 rounds of revisions; further rounds or changes to an approved brief may be charged."
  );

  heading(5, "Client responsibilities");
  para("The Client provides brand assets, product information, account access and timely feedback, and confirms it has the rights to any material it shares with Inloop.");

  heading(6, "Ownership and confidentiality");
  para(
    "Once the related fees are paid, the final deliverables belong to the Client. Inloop may show the work in its portfolio unless the Client asks it not to in writing. " +
      "Both sides keep each other's business information confidential, during and after the engagement."
  );

  heading(7, "Termination");
  para("Either side may end this MOU with 30 days' written notice. Fees for work done up to the end of the notice period remain payable.");

  heading(8, "Your Inloop client dashboard");
  para(
    `All approvals, files and conversations with the Inloop team happen on your client dashboard: ${clean(crmUrl)}/client`,
    { gap: 4 }
  );
  para(`Login email: ${blank(t.client_email || lead.email)}`, { font: bold, gap: 4 });
  para("The account is switched on as soon as Inloop receives this MOU signed. To log in, enter the email above and the one-time code (OTP) sent to it — no password needed.", { size: 9, color: MUTED });

  if (clean(t.notes).trim()) {
    heading(9, "Other terms");
    para(t.notes);
  }

  // Signatures — the client signs inside the box on the right (the CRM checks this box on the returned copy)
  ensure(170);
  y -= 14;
  page.drawText("SIGNED AND AGREED", { x: M, y: y - 10, size: 10.5, font: bold, color: INK });
  y -= 26;
  const colW = (W - 2 * M - 24) / 2;
  const box = (x, title, name, role, label) => {
    page.drawText(clean(title), { x, y: y - 10, size: 9, font: bold, color: MUTED });
    page.drawRectangle({ x, y: y - 94, width: colW, height: 74, borderColor: BRAND, borderWidth: 0.8, color: rgb(0.985, 0.985, 1) });
    page.drawText(label, { x: x + 8, y: y - 88, size: 7.5, font: regular, color: MUTED });
    page.drawText(clean(`Name: ${blank(name, 22)}`), { x, y: y - 112, size: 9, font: regular, color: INK });
    page.drawText(clean(`Designation: ${blank(role, 18)}`), { x, y: y - 126, size: 9, font: regular, color: INK });
    page.drawText("Date: ____________________", { x, y: y - 140, size: 9, font: regular, color: INK });
  };
  box(M, "For Inloop Media", t.agency_signatory, t.agency_title, "Signature");
  box(M + colW + 24, `For ${t.client_legal_name || brand.name}`, t.signatory_name || [lead.first_name, lead.last_name].filter(Boolean).join(" "), t.signatory_title, "Client signature");
  y -= 150;
  para("Please sign in the box above and reply to the email with the signed copy (a scan or photo is fine).", { size: 8.5, color: MUTED });

  return pdf.save();
}
