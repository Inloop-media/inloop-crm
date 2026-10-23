import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/supabase/server";
import { addEvents } from "@/lib/leads";

const REQUIRED = ["firstName", "lastName", "phone", "email", "company", "location", "service"];
const str = (v, max = 5000) => String(v ?? "").trim().slice(0, max);

function authorised(request) {
  const expected = process.env.CRM_INTAKE_SECRET || "";
  const given = request.headers.get("x-intake-secret") || "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Website contact form → new lead. Called server-to-server by inloop-website's /api/lead. */
export async function POST(request) {
  if (!authorised(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (body.website) return Response.json({ ok: true }); // honeypot
  const missing = REQUIRED.filter((k) => !str(body[k]));
  if (missing.length) return Response.json({ ok: false, error: `Missing: ${missing.join(", ")}` }, { status: 400 });

  const { data, error } = await db()
    .from("leads")
    .insert({
      first_name: str(body.firstName, 100),
      last_name: str(body.lastName, 100),
      phone: str(body.phone, 40),
      email: str(body.email, 200),
      brand: str(body.company, 200),
      location: str(body.location, 200),
      service: str(body.service, 200),
      budget: str(body.budget, 100),
      details: str(body.message),
      newsletter: Boolean(body.newsletter),
      source: "website",
    })
    .select("id, code")
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await addEvents(data.id, null, [{ type: "created", data: { source: "website" } }]);
  return Response.json({ ok: true, id: data.code });
}
