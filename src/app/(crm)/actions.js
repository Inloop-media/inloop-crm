"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { addEvents } from "@/lib/leads";
import { canAssign, canCreateLead, canManageTeam, canSeeLead } from "@/lib/permissions";
import { OPS_HANDOFF_STATUS, ROLES, STATUS_NAMES } from "@/lib/constants";

const str = (v, max = 5000) => String(v ?? "").trim().slice(0, max);

/** Change status / owner / remarks / brief on a lead. Every change is logged in the lead's history. */
export async function updateLead(id, patch) {
  const me = await requireMember();
  const { data: lead } = await db().from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead || !canSeeLead(me, lead)) return { ok: false, error: "You can't edit this lead." };

  const now = new Date().toISOString();
  const changes = {};
  const events = [];

  if ("status" in patch && patch.status !== lead.status) {
    if (!STATUS_NAMES.includes(patch.status)) return { ok: false, error: "Unknown status." };
    changes.status = patch.status;
    events.push({ type: "status", data: { from: lead.status, to: patch.status } });
    if (patch.status === OPS_HANDOFF_STATUS && !lead.handed_to_ops_at) changes.handed_to_ops_at = now;
  }

  if ("assigned_to" in patch) {
    const to = patch.assigned_to || null;
    if (to !== lead.assigned_to) {
      if (!canAssign(me)) return { ok: false, error: "Only admins and ops can assign leads." };
      let toName = null;
      if (to) {
        const { data: m } = await db().from("members").select("id, name, active").eq("id", to).maybeSingle();
        if (!m || !m.active) return { ok: false, error: "That team member isn't active." };
        toName = m.name;
      }
      changes.assigned_to = to;
      changes.assigned_at = to ? now : null;
      events.push({ type: "assigned", data: { to: toName } });
    }
  }

  for (const field of ["remarks", "brief"]) {
    if (field in patch) {
      const v = str(patch[field], 10000);
      if (v !== lead[field]) {
        changes[field] = v;
        events.push({ type: field, data: { text: v.slice(0, 280) } });
      }
    }
  }

  if (!events.length) return { ok: true };
  changes.updated_at = now;
  const { error } = await db().from("leads").update(changes).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await addEvents(id, me.id, events);

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}

/** Add a lead by hand (calls, referrals, events…). */
export async function createLead(_prev, formData) {
  const me = await requireMember();
  if (!canCreateLead(me)) return { error: "Only admins and ops can add leads." };

  const row = {
    first_name: str(formData.get("first_name"), 100),
    last_name: str(formData.get("last_name"), 100),
    phone: str(formData.get("phone"), 40),
    email: str(formData.get("email"), 200),
    brand: str(formData.get("brand"), 200),
    location: str(formData.get("location"), 200),
    service: str(formData.get("service"), 200),
    budget: str(formData.get("budget"), 100),
    details: str(formData.get("details")),
    source: str(formData.get("source"), 60) || "manual",
  };
  if (!row.first_name || !(row.phone || row.email)) return { error: "Add at least a first name and a phone number or email." };

  const assignee = str(formData.get("assigned_to"), 40);
  if (assignee) {
    row.assigned_to = assignee;
    row.assigned_at = new Date().toISOString();
  }

  const { data, error } = await db().from("leads").insert(row).select("id").single();
  if (error) return { error: error.message };
  await addEvents(data.id, me.id, [{ type: "created", data: { source: row.source } }]);
  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

/* ------------------------------ Team ------------------------------ */

export async function addMember(_prev, formData) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { error: "Only admins can manage the team." };
  const email = str(formData.get("email"), 200).toLowerCase();
  const name = str(formData.get("name"), 100);
  const role = str(formData.get("role"), 20);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  if (!name) return { error: "Enter a name." };
  if (!ROLES.some((r) => r.id === role)) return { error: "Pick a role." };

  const { error } = await db().from("members").insert({ email, name, role });
  if (error) return { error: error.code === "23505" ? "That email is already on the team." : error.message };
  revalidatePath("/team");
  return { ok: true, message: `${name} added — they can now sign in with ${email}.` };
}

export async function updateMember(id, patch) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { ok: false, error: "Only admins can manage the team." };
  const demotingSelf = id === me.id && ((patch.role && patch.role !== "admin") || patch.active === false);
  if (demotingSelf) {
    return { ok: false, error: "You can't remove your own admin access." };
  }
  const changes = {};
  if (patch.role && ROLES.some((r) => r.id === patch.role)) changes.role = patch.role;
  if (typeof patch.active === "boolean") changes.active = patch.active;
  if (typeof patch.name === "string" && patch.name.trim()) changes.name = str(patch.name, 100);
  const { error } = await db().from("members").update(changes).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/team");
  revalidatePath("/leads");
  return { ok: true };
}
