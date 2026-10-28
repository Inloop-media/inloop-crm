"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { addEvents } from "@/lib/leads";
import {
  canAssign,
  canBookDiscovery,
  canBookProposal,
  canCreateLead,
  canManageTeam,
  canSeeLead,
  canSetStatus,
} from "@/lib/permissions";
import { DISCOVERY_STATUS, GROUP_KINDS, MEETING_KINDS, MEETING_MINUTES, PROPOSAL_STATUS, ROLES, STATUS_NAMES, UPDATE_EVENTS } from "@/lib/constants";
import { CalendarError, cancelEvent, createMeetEvent } from "@/lib/google";
import { discoveryMessage, proposalMessage } from "@/lib/messages";
import { announce } from "@/lib/updates";
import { shareBriefWithStrategists } from "@/lib/proposals";
import { fmtDateTime, fullName } from "@/lib/format";

const str = (v, max = 5000) => String(v ?? "").trim().slice(0, max);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

/** Name of an active member in a sales group, or null if they can't take leads. */
async function assigneeName(memberId) {
  if (!isUuid(memberId)) return null;
  const { data: m } = await db()
    .from("members")
    .select("name, active, group_members(group:groups(kind))")
    .eq("id", memberId)
    .maybeSingle();
  const sales = (m?.group_members || []).some((g) => g.group?.kind === "sales");
  return m && m.active && sales ? m.name : null;
}

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
    if (!canSetStatus(me, lead.status, patch.status)) {
      return { ok: false, error: `Executives can set the status up to "${DISCOVERY_STATUS}". Ask an admin for the next steps.` };
    }
    changes.status = patch.status;
    events.push({ type: "status", data: { from: lead.status, to: patch.status } });
  }

  if ("assigned_to" in patch) {
    const to = patch.assigned_to || null;
    if (to !== lead.assigned_to) {
      if (!canAssign(me)) return { ok: false, error: "Only admins and ops can assign leads." };
      let toName = null;
      if (to) {
        toName = await assigneeName(to);
        if (!toName) return { ok: false, error: "Leads can only go to active members of a sales group." };
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
  revalidatePath("/");
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
    if (!(await assigneeName(assignee))) return { error: "Leads can only go to active members of a sales group." };
    row.assigned_to = assignee;
    row.assigned_at = new Date().toISOString();
  }

  const { data, error } = await db().from("leads").insert(row).select("id").single();
  if (error) return { error: error.message };
  await addEvents(data.id, me.id, [{ type: "created", data: { source: row.source } }]);
  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

/* ---------------------------- Meetings ---------------------------- */

const calendarFail = (err) =>
  err instanceof CalendarError
    ? { ok: false, error: err.message, reconnect: err.reconnect }
    : { ok: false, error: "Something went wrong talking to Google Calendar." };

/**
 * Books a Google Meet from the signed-in member's calendar.
 * discovery: the lead's executive, only at "Discovery Call" — invites the lead + the guests they picked
 *            (meeting_guests ids; emails are looked up here, never sent to the browser); status stays.
 * proposal:  admin / ops, once the brief is written — invites only the lead, moves the status to
 *            "Proposal Meeting Scheduled" and shares the brief with the creative strategists (+ Slack).
 * `when` is a datetime-local value ("2026-10-29T15:30"), read as India time.
 */
export async function scheduleMeeting(leadId, kind, when, guestIds = []) {
  const me = await requireMember();
  if (!MEETING_KINDS[kind]) return { ok: false, error: "Unknown meeting type." };
  const { data: lead } = await db().from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead || !canSeeLead(me, lead)) return { ok: false, error: "You can't book a meeting for this lead." };

  if (kind === "discovery") {
    if (!canBookDiscovery(me, lead)) return { ok: false, error: "Only the executive this lead is assigned to can book the discovery call." };
    if (lead.status !== DISCOVERY_STATUS) return { ok: false, error: `Set the status to "${DISCOVERY_STATUS}" first.` };
  } else {
    if (!canBookProposal(me)) return { ok: false, error: "Only admins can book proposal meetings." };
    if (!lead.brief.trim()) return { ok: false, error: "Add the client brief first — it goes to the creative strategists." };
  }

  const start = new Date(`${String(when || "")}:00+05:30`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(when || "")) || isNaN(start)) return { ok: false, error: "Pick a date and time." };
  if (start.getTime() < Date.now() - 5 * 60000) return { ok: false, error: "That time is in the past." };

  const { data: existing } = await db()
    .from("meetings")
    .select("id")
    .eq("lead_id", leadId)
    .eq("kind", kind)
    .is("cancelled_at", null)
    .gte("ends_at", new Date().toISOString())
    .limit(1);
  if (existing?.length) return { ok: false, error: `A ${MEETING_KINDS[kind].label.toLowerCase()} is already booked. Cancel it to book a new one.` };

  const end = new Date(start.getTime() + MEETING_MINUTES[kind] * 60000);
  const attendees = [];
  if (/^\S+@\S+\.\S+$/.test(lead.email)) attendees.push(lead.email.toLowerCase());
  // What the person booking sees: the client by email, teammates by name
  const invited = attendees.length ? ["the client"] : [];
  if (kind === "discovery") {
    const ids = (Array.isArray(guestIds) ? guestIds : []).filter(isUuid).slice(0, 20);
    if (ids.length) {
      const { data: guests } = await db().from("meeting_guests").select("name, email").in("id", ids).eq("active", true);
      for (const g of guests || []) {
        const email = g.email.toLowerCase();
        // The organiser is on the event already
        if (email !== me.email && !attendees.includes(email)) {
          attendees.push(email);
          invited.push(g.name);
        }
      }
    }
  }

  const brand = lead.brand || fullName(lead);
  const message = { firstName: lead.first_name, brand: lead.brand, service: lead.service, sender: me.name };
  let event;
  try {
    event = await createMeetEvent(me.id, {
      summary: `Inloop Media × ${brand || (kind === "discovery" ? "Introductory Call" : "Proposal")}`,
      description: kind === "discovery" ? discoveryMessage(message) : proposalMessage(message),
      start,
      end,
      attendees,
    });
  } catch (err) {
    return calendarFail(err);
  }

  const { error } = await db().from("meetings").insert({
    lead_id: leadId,
    kind,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    meet_link: event.link,
    event_id: event.eventId,
    organizer_id: me.id,
    attendees,
  });
  if (error) return { ok: false, error: `The invite went out, but saving it failed: ${error.message}` };

  const events = [{ type: "meeting", data: { kind, at: start.toISOString() } }];
  const leadChanges = { updated_at: new Date().toISOString() };
  if (kind === "proposal" && lead.status !== PROPOSAL_STATUS) {
    leadChanges.status = PROPOSAL_STATUS;
    events.push({ type: "status", data: { from: lead.status, to: PROPOSAL_STATUS } });
  }
  await db().from("leads").update(leadChanges).eq("id", leadId);
  await addEvents(leadId, me.id, events);

  if (kind === "proposal") {
    await shareBriefWithStrategists(lead, me);
    let executive = null;
    if (lead.assigned_to) {
      const { data: m } = await db().from("members").select("name").eq("id", lead.assigned_to).maybeSingle();
      executive = m?.name;
    }
    after(() =>
      announce("proposal_meeting", {
        lead,
        title: `Proposal meeting — ${brand} (${lead.code}) · ${fmtDateTime(start)}`,
        body: [
          `Service: ${lead.service || "—"} · Executive: ${executive || "—"} · Booked by ${me.name}`,
          lead.brief ? `Brief:\n${lead.brief.slice(0, 2500)}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      })
    );
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/briefs");
  revalidatePath("/");
  return { ok: true, invited };
}

/** Cancels a meeting in Google Calendar (guests get an email) and removes it from the CRM. */
export async function cancelMeeting(meetingId) {
  const me = await requireMember();
  const { data: m } = await db().from("meetings").select("*, lead:leads(*)").eq("id", meetingId).maybeSingle();
  if (!m || m.cancelled_at || !canSeeLead(me, m.lead)) return { ok: false, error: "Meeting not found." };
  const allowed = m.organizer_id === me.id || me.role === "admin" || (m.kind === "proposal" && canBookProposal(me));
  if (!allowed) return { ok: false, error: "Only the person who booked it can cancel this meeting." };

  try {
    // The event lives in the organiser's calendar, so it's cancelled with their connection
    if (m.organizer_id) await cancelEvent(m.organizer_id, m.event_id);
  } catch (err) {
    return calendarFail(err);
  }
  await db().from("meetings").update({ cancelled_at: new Date().toISOString() }).eq("id", meetingId);
  await addEvents(m.lead_id, me.id, [{ type: "meeting_cancelled", data: { kind: m.kind, at: m.starts_at } }]);
  revalidatePath(`/leads/${m.lead_id}`);
  revalidatePath("/");
  return { ok: true };
}

/** Disconnects the signed-in member's Google Calendar. */
export async function disconnectCalendar() {
  const me = await requireMember();
  await db().from("members").update({ google_refresh_token: null, calendar_connected_at: null }).eq("id", me.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------ Team ------------------------------ */

async function setMemberGroups(memberId, groupIds) {
  const ids = [...new Set(groupIds.filter(isUuid))];
  await db().from("group_members").delete().eq("member_id", memberId);
  if (ids.length) await db().from("group_members").insert(ids.map((group_id) => ({ group_id, member_id: memberId })));
}

export async function addMember(_prev, formData) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { error: "Only admins can manage the team." };
  const email = str(formData.get("email"), 200).toLowerCase();
  const name = str(formData.get("name"), 100);
  const role = str(formData.get("role"), 20) || "member";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  if (!name) return { error: "Enter a name." };
  if (!ROLES.some((r) => r.id === role)) return { error: "Pick an access level." };

  const { data, error } = await db().from("members").insert({ email, name, role }).select("id").single();
  if (error) return { error: error.code === "23505" ? "That email is already on the team." : error.message };
  await setMemberGroups(data.id, formData.getAll("groups").map(String));
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
  if (Object.keys(changes).length) {
    const { error } = await db().from("members").update(changes).eq("id", id);
    if (error) return { ok: false, error: error.message };
  }
  if (Array.isArray(patch.groups)) await setMemberGroups(id, patch.groups);
  revalidatePath("/team");
  revalidatePath("/leads");
  return { ok: true };
}

/* ----------------------------- Groups ----------------------------- */

export async function createGroup(_prev, formData) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { error: "Only admins can manage groups." };
  const name = str(formData.get("name"), 60);
  const kind = str(formData.get("kind"), 20);
  if (!name) return { error: "Give the group a name." };
  if (!GROUP_KINDS.some((k) => k.id === kind)) return { error: "Pick what the group does." };
  const notify = formData.getAll("notify").map(String).filter((e) => UPDATE_EVENTS.some((u) => u.id === e));
  const { error } = await db().from("groups").insert({ name, kind, notify });
  if (error) return { error: error.code === "23505" ? "A group with that name already exists." : error.message };
  revalidatePath("/team");
  return { ok: true, message: `${name} created — add people to it below.` };
}

export async function updateGroup(id, patch) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { ok: false, error: "Only admins can manage groups." };
  if (!isUuid(id)) return { ok: false, error: "Group not found." };
  if (patch.delete) {
    await db().from("groups").delete().eq("id", id);
  } else {
    const changes = {};
    if (typeof patch.name === "string" && patch.name.trim()) changes.name = str(patch.name, 60);
    if (patch.kind && GROUP_KINDS.some((k) => k.id === patch.kind)) changes.kind = patch.kind;
    if (Array.isArray(patch.notify)) changes.notify = patch.notify.filter((e) => UPDATE_EVENTS.some((u) => u.id === e));
    if (Object.keys(changes).length) {
      const { error } = await db().from("groups").update(changes).eq("id", id);
      if (error) return { ok: false, error: error.code === "23505" ? "A group with that name already exists." : error.message };
    }
    if (isUuid(patch.addMember)) await db().from("group_members").upsert({ group_id: id, member_id: patch.addMember });
    if (isUuid(patch.removeMember)) await db().from("group_members").delete().eq("group_id", id).eq("member_id", patch.removeMember);
  }
  revalidatePath("/team");
  revalidatePath("/updates");
  return { ok: true };
}

/* -------------------------- Meeting guests -------------------------- */

export async function addGuest(_prev, formData) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { error: "Only admins can change the guest list." };
  const name = str(formData.get("name"), 80);
  const email = str(formData.get("email"), 200).toLowerCase();
  if (!name) return { error: "Enter a name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  const { error } = await db().from("meeting_guests").upsert({ name, email, active: true }, { onConflict: "email" });
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true, message: `${name} can now be added to discovery calls.` };
}

export async function updateGuest(id, patch) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { ok: false, error: "Only admins can change the guest list." };
  if (!isUuid(id)) return { ok: false, error: "Guest not found." };
  const changes = {};
  if (typeof patch.active === "boolean") changes.active = patch.active;
  if (typeof patch.is_default === "boolean") changes.is_default = patch.is_default;
  const { error } = await db().from("meeting_guests").update(changes).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/team");
  return { ok: true };
}
