"use server";

import { revalidatePath, updateTag } from "next/cache";
import { pingLive } from "@/lib/live";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getCurrentMember, requireMember } from "@/lib/auth";
import { teamLeadIdsOf } from "@/lib/groups";
import { db } from "@/lib/supabase/server";
import { addEvents, listLeads } from "@/lib/leads";
import {
  canAssign,
  canBookDiscovery,
  canBookProposal,
  canCreateLead,
  canEditGroup,
  canMakeGroups,
  canManageTeam,
  canSeeLead,
  isAdmin,
  isSalesHead,
  canSeeAllLeads,
  salesTeam,
  canSetStatus,
} from "@/lib/permissions";
import { DISCOVERY_STATUS, GROUP_KINDS, MEETING_KINDS, MEETING_MINUTES, PROPOSAL_STATUS, ROLES, STATUS_NAMES, UPDATE_EVENTS } from "@/lib/constants";
import { CalendarError, cancelEvent, createMeetEvent } from "@/lib/google";
import { discoveryMessage, proposalMessage } from "@/lib/messages";
import { announce } from "@/lib/updates";
import { pushTo } from "@/lib/push";
import { shareBriefWithStrategists } from "@/lib/proposals";
import { onboardLead } from "@/lib/clients";
import { fmtDateTime, fullName } from "@/lib/format";

const str = (v, max = 5000) => String(v ?? "").trim().slice(0, max);
const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));
const isStaffMember = (me) => me.role === "admin" || me.role === "ops";

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
      // A sales head hands leads out within their own team
      if (to && !canSeeAllLeads(me) && ![me.id, ...salesTeam(me)].includes(to)) return { ok: false, error: "You can only assign leads to people in your team." };
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
  if (changes.assigned_to && changes.assigned_to !== me.id) after(() => pushNewLead([changes.assigned_to], lead, "New lead assigned to you"));
  // Won → brand onboarded, everyone celebrates, and the brand gets its client login
  if (changes.status === "Won") await onboardLead(id, me.id).catch((e) => console.error("Onboarding failed:", e));

  revalidatePath("/leads");
  pingLive("leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Admin only: delete a lead for good — its notes, history, meetings, proposal and files go with it.
 * A lead that became a brand can't be deleted here (the brand, its tasks and its calendar hang off it).
 */
export async function deleteLead(id) {
  const me = await requireMember();
  if (me.role !== "admin") return { ok: false, error: "Only admin can delete leads." };
  const { data: lead } = await db().from("leads").select("id, code").eq("id", id).maybeSingle();
  if (!lead) return { ok: false, error: "Lead not found." };
  const { data: brand } = await db().from("brands").select("id, name").eq("lead_id", id).maybeSingle();
  if (brand) return { ok: false, error: `${brand.name} is a client now — this lead can't be deleted (it would delete the brand too).` };

  // Upcoming Google Meet invites: cancel them so the client doesn't join a call for a deleted lead
  const { data: meetings } = await db().from("meetings").select("organizer_id, event_id").eq("lead_id", id).is("cancelled_at", null).gt("starts_at", new Date().toISOString());
  for (const m of meetings || []) if (m.organizer_id && m.event_id) await cancelEvent(m.organizer_id, m.event_id).catch(() => {});
  // Its uploaded files (proposal inputs and decks) live in storage
  const { data: docs } = await db().from("lead_documents").select("storage_path").eq("lead_id", id);
  const paths = (docs || []).map((d) => d.storage_path).filter(Boolean);
  if (paths.length) await db().storage.from("lead-docs").remove(paths).catch(() => {});

  const { error } = await db().from("leads").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  pingLive("leads");
  revalidatePath("/leads");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Set (or clear, with at = "") a follow-up reminder on a lead. `at` is India time "YYYY-MM-DDTHH:MM".
 * The owner gets a phone notification at that time (lib/reminders.js).
 */
export async function setFollowUp(id, at, note = "") {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Lead not found." };
  const { data: lead } = await db().from("leads").select("id, assigned_to").eq("id", id).maybeSingle();
  if (!lead || !canSeeLead(me, lead)) return { ok: false, error: "You can't edit this lead." };
  let when = null;
  if (at) {
    const d = new Date(`${String(at).slice(0, 16)}:00+05:30`);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Pick a valid date and time." };
    when = d.toISOString();
  }
  const { error } = await db()
    .from("leads")
    .update({ follow_up_at: when, follow_up_note: when ? str(note, 300) : "", follow_up_notified_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: /follow_up/.test(error.message) ? "Reminders need migration 014 — ask the admin to run it." : error.message };
  revalidatePath(`/leads/${id}`);
  revalidatePath("/");
  return { ok: true };
}

/** Phone notification about a lead, e.g. to the executive it was just assigned to. */
async function pushNewLead(memberIds, lead, title) {
  const { data } = await db().from("leads").select("id, code, brand, first_name, last_name, service").eq("id", lead.id).single();
  if (!data) return;
  await pushTo(memberIds, { title: `${title} — ${data.brand || fullName(data)} (${data.code})`, body: data.service || "", url: `/leads/${data.id}`, tag: `lead-${data.id}` });
}

/* ------------------------- Push notifications ------------------------- */

/** Saves this device's push subscription for the signed-in member. */
export async function savePushSubscription(sub, userAgent = "") {
  const me = await requireMember();
  const endpoint = str(sub?.endpoint, 2000);
  const p256dh = str(sub?.keys?.p256dh, 400);
  const auth = str(sub?.keys?.auth, 400);
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false, error: "This browser sent an invalid subscription." };
  // A local copy shares the live database — don't save its subscriptions (they'd show as "localhost")
  if (process.env.NODE_ENV !== "production") return { ok: false, error: "Notifications only work on inloophub.com." };
  const { error } = await db()
    .from("push_subscriptions")
    .upsert({ member_id: me.id, endpoint, p256dh, auth, user_agent: str(userAgent, 300) }, { onConflict: "endpoint" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint) {
  const me = await requireMember();
  await db().from("push_subscriptions").delete().eq("member_id", me.id).eq("endpoint", str(endpoint, 2000));
  return { ok: true };
}

/** Sends a test notification to all of the signed-in member's devices. */
export async function sendTestPush() {
  const me = await requireMember();
  // A new tag each time: with the same tag the Mac quietly replaces the last test instead of showing it again
  const at = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit" });
  await pushTo([me.id], { title: "Notifications are on", body: `You'll hear from loop here, ${me.name.split(" ")[0]} · test at ${at}`, url: "/", tag: `test-${Date.now()}` });
  return { ok: true };
}

const FEEDBACK_KINDS = ["problem", "idea", "general"];
const FEEDBACK_STATUSES = ["new", "seen", "done"];

/** A note about the CRM from anyone except an admin. Admins get a phone notification. */
export async function submitFeedback({ mood, kind, message, page } = {}) {
  const me = await requireMember();
  if (me.role === "admin") return { ok: false, error: "Admins read feedback rather than send it." };
  const text = str(message, 4000);
  if (text.length < 3) return { ok: false, error: "Write a few words first." };
  const row = {
    member_id: me.id,
    mood: [1, 2, 3, 4, 5].includes(Number(mood)) ? Number(mood) : null,
    kind: FEEDBACK_KINDS.includes(kind) ? kind : "general",
    message: text,
    page: str(page, 200),
  };
  const { error } = await db().from("feedback").insert(row);
  if (error) return { ok: false, error: error.message };
  after(async () => {
    const { data: admins } = await db().from("members").select("id").eq("role", "admin").eq("active", true);
    const label = { problem: "A problem", idea: "An idea", general: "Feedback" }[row.kind];
    await pushTo((admins || []).map((a) => a.id), { title: `${label} from ${me.name}`, body: text.slice(0, 140), url: "/feedback", tag: "feedback" });
  });
  revalidatePath("/feedback");
  return { ok: true };
}

/** Admin: mark a note as seen / done (or back to new). */
export async function setFeedbackStatus(id, status) {
  await requireMember(["admin"]);
  if (!isUuid(id) || !FEEDBACK_STATUSES.includes(status)) return { ok: false, error: "Invalid request." };
  const { error } = await db().from("feedback").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/feedback");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Add a lead by hand (calls, referrals, events…). */
export async function createLead(_prev, formData) {
  const me = await requireMember();
  if (!canCreateLead(me)) return { error: "Only admins and the sales head can add leads. Share it in your group chat instead." };

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
    if (!isStaffMember(me) && assignee !== me.id && !salesTeam(me).includes(assignee)) return { error: "You can only give leads to people in your team." };
    row.assigned_to = assignee;
    row.assigned_at = new Date().toISOString();
  }

  const { data, error } = await db().from("leads").insert(row).select("id").single();
  if (error) return { error: error.message };
  await addEvents(data.id, me.id, [{ type: "created", data: { source: row.source } }]);
  if (row.assigned_to && row.assigned_to !== me.id) after(() => pushNewLead([row.assigned_to], { ...row, ...data }, "New lead assigned to you"));
  revalidatePath("/leads");
  pingLive("leads");
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
/** Lead meetings (any lead, any kind) that overlap [start, end) — two calls can't share a slot. */
async function clashingMeeting(start, end) {
  const { data } = await db()
    .from("meetings")
    .select("id, kind, starts_at, ends_at, organizer:members(name)")
    .is("cancelled_at", null)
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .limit(1);
  return data?.[0] || null;
}

const IST_TIME = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

/**
 * The slots already taken on one day (India time), for the booking picker: [{ start, end, by, kind }].
 * Only who booked it is shown, not which client.
 */
export async function meetingSlots(day) {
  if (!(await getCurrentMember())) return { ok: false, taken: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ""))) return { ok: false, taken: [] };
  const from = new Date(`${day}T00:00:00+05:30`);
  const to = new Date(from.getTime() + 864e5);
  const { data } = await db()
    .from("meetings")
    .select("starts_at, ends_at, kind, organizer:members(name)")
    .is("cancelled_at", null)
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString())
    .order("starts_at");
  return { ok: true, taken: (data || []).map((m) => ({ start: m.starts_at, end: m.ends_at, kind: m.kind, by: m.organizer?.name || "Someone" })) };
}

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));

/**
 * Book a Google Meet with the client.
 *   guestIds   teammates from the guest list
 *   extra      { clientEmails: [the lead's own emails to invite], guestEmails: [anyone else, e.g. the client's partner],
 *                minutes: 30 | 60 }
 */
export async function scheduleMeeting(leadId, kind, when, guestIds = [], extra = {}) {
  const me = await requireMember();
  if (!MEETING_KINDS[kind]) return { ok: false, error: "Unknown meeting type." };
  const { data: lead } = await db().from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead || !canSeeLead(me, lead)) return { ok: false, error: "You can't book a meeting for this lead." };

  if (kind === "discovery") {
    if (!canBookDiscovery(me, lead)) return { ok: false, error: "Only the executive this lead is assigned to can book the discovery call." };
    if (lead.status !== DISCOVERY_STATUS) return { ok: false, error: `Set the status to "${DISCOVERY_STATUS}" first.` };
  } else {
    if (!canBookProposal(me, lead)) return { ok: false, error: "Only the executive on this lead (or an admin) can book the proposal meeting." };
    if (!canSeeAllLeads(me) && !isSalesHead(me) && lead.status !== DISCOVERY_STATUS) {
      // The executive on the lead: fine once the discovery call is booked / done, whatever the status says now
      const { count } = await db().from("meetings").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("kind", "discovery").is("cancelled_at", null);
      if (!count) return { ok: false, error: `Do the discovery call first — book it, or set the status to "${DISCOVERY_STATUS}".` };
    }
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

  const minutes = [30, 60].includes(Number(extra.minutes)) ? Number(extra.minutes) : MEETING_MINUTES[kind];
  const end = new Date(start.getTime() + minutes * 60000);
  const clash = await clashingMeeting(start, end);
  if (clash)
    return {
      ok: false,
      error: `That slot is taken — ${clash.organizer?.name || "someone"} has a ${MEETING_KINDS[clash.kind]?.label.toLowerCase() || "meeting"} from ${IST_TIME.format(new Date(clash.starts_at))} to ${IST_TIME.format(new Date(clash.ends_at))}. Pick another time.`,
    };

  // The client: their main email plus any extra ones the executive picked
  const own = [lead.email, ...(Array.isArray(lead.extra_contacts) ? lead.extra_contacts : []).filter((c) => c.type === "email").map((c) => c.value)]
    .map((e) => String(e || "").toLowerCase())
    .filter(emailOk);
  const picked = Array.isArray(extra.clientEmails) ? extra.clientEmails.map((e) => String(e).toLowerCase()).filter((e) => own.includes(e)) : own.slice(0, 1);
  const attendees = [...new Set(picked)];
  // What the person booking sees: the client by email, teammates by name
  const invited = attendees.length ? ["the client"] : [];
  // Anyone else the client asked to bring along
  for (const e of (Array.isArray(extra.guestEmails) ? extra.guestEmails : []).slice(0, 10)) {
    const email = String(e || "").trim().toLowerCase();
    if (emailOk(email) && !attendees.includes(email) && email !== me.email) {
      attendees.push(email);
      invited.push(email);
    }
  }
  {
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

/** Work email domains people can be added with (plus any in ALLOWED_DOMAIN, comma-separated). */
const TEAM_DOMAINS = [...new Set(["inloopmedia.com", "amsglobal.io", ...String(process.env.ALLOWED_DOMAIN || "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean)])];

export async function addMember(_prev, formData) {
  const me = await requireMember();
  if (!canManageTeam(me)) return { error: "Only admins can manage the team." };
  const email = str(formData.get("email"), 200).toLowerCase();
  const name = str(formData.get("name"), 100);
  const role = str(formData.get("role"), 20) || "member";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };
  if (!TEAM_DOMAINS.includes(email.split("@")[1])) return { error: `Use a work email (${TEAM_DOMAINS.map((d) => `@${d}`).join(" or ")}).` };
  if (!name) return { error: "Enter a name." };
  if (!ROLES.some((r) => r.id === role)) return { error: "Pick an access level." };

  const { data, error } = await db().from("members").insert({ email, name, role }).select("id").single();
  if (error) return { error: error.code === "23505" ? "That email is already on the team." : error.message };
  await setMemberGroups(data.id, formData.getAll("groups").map(String));
  revalidatePath("/team");
  updateTag("groups");
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
  if (typeof patch.can_see_documents === "boolean") changes.can_see_documents = patch.can_see_documents;
  if (Object.keys(changes).length) {
    const { error } = await db().from("members").update(changes).eq("id", id);
    if (error) return { ok: false, error: /can_see_documents/.test(error.message) ? "Run migration 020 in Supabase first." : error.message };
  }
  if (Array.isArray(patch.groups)) await setMemberGroups(id, patch.groups);
  revalidatePath("/team");
  updateTag("groups");
  revalidatePath("/leads");
  pingLive("leads");
  return { ok: true };
}

/* ----------------------------- Groups ----------------------------- */

const MIGRATION_021 = "Groups with managers and more than one team lead need migration 021 — run it in Supabase first.";
const uuids = (v) => [...new Set((Array.isArray(v) ? v : []).filter(isUuid))];

function refreshGroups(id) {
  pingLive("groups");
  revalidatePath("/team");
  updateTag("groups");
  revalidatePath("/groups");
  if (id) revalidatePath(`/groups/${id}`);
  revalidatePath("/dm");
  revalidatePath("/updates");
}

/** Admin makes any group; a CBO makes groups that come under them. */
export async function createGroup(_prev, formData) {
  const me = await requireMember();
  if (!canMakeGroups(me)) return { error: "Only admins and CBOs can make groups." };
  const name = str(formData.get("name"), 60);
  const kind = str(formData.get("kind"), 20);
  if (!name) return { error: "Give the group a name." };
  if (!GROUP_KINDS.some((k) => k.id === kind)) return { error: "Pick what the group does." };
  if (kind === "execution" && !isAdmin(me)) return { error: "Only an admin can make a CBO group." };
  const notify = formData.getAll("notify").map(String).filter((e) => UPDATE_EVENTS.some((u) => u.id === e));
  const owner = isAdmin(me) ? (isUuid(String(formData.get("owner") || "")) && kind !== "execution" ? String(formData.get("owner")) : null) : me.id;
  const row = { name, kind, notify };
  if (owner) row.owner_id = owner;
  const { data, error } = await db().from("groups").insert(row).select("id").single();
  if (error) return { error: error.code === "23505" ? "A group with that name already exists." : /owner_id/.test(error.message) ? MIGRATION_021 : error.message };
  refreshGroups(data.id);
  return { ok: true, id: data.id, message: `${name} created — add people to it.` };
}

/**
 * Change a group: name, kind, posts, the CBO it comes under (admin only), its heads,
 * team leads (people in the group) and members. Admin: any group. CBO: their own groups.
 */
export async function updateGroup(id, patch) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Group not found." };
  const { data: g } = await db().from("groups").select("*, group_members(member_id)").eq("id", id).maybeSingle();
  if (!g) return { ok: false, error: "Group not found." };
  if (!canEditGroup(me, g)) return { ok: false, error: "Only an admin or the group's CBO can change it." };
  if (patch.delete) {
    await db().from("groups").delete().eq("id", id);
    refreshGroups(id);
    return { ok: true };
  }
  const inGroup = new Set((g.group_members || []).map((x) => x.member_id));
  const changes = {};
  if (typeof patch.name === "string" && patch.name.trim()) changes.name = str(patch.name, 60);
  if (patch.kind && GROUP_KINDS.some((k) => k.id === patch.kind) && (isAdmin(me) || patch.kind !== "execution")) changes.kind = patch.kind;
  if (Array.isArray(patch.notify)) changes.notify = patch.notify.filter((e) => UPDATE_EVENTS.some((u) => u.id === e));
  if ("owner_id" in patch && isAdmin(me)) changes.owner_id = isUuid(patch.owner_id) ? patch.owner_id : null;
  if (Array.isArray(patch.head_ids)) {
    changes.head_ids = uuids(patch.head_ids);
    changes.lead_id = changes.head_ids[0] || null; // older readers
  }
  if (Array.isArray(patch.team_lead_ids)) {
    const ids = uuids(patch.team_lead_ids);
    if (ids.some((x) => !inGroup.has(x))) return { ok: false, error: "A team lead has to be someone in this group." };
    changes.team_lead_ids = ids;
    changes.team_lead_id = ids[0] || null;
  }
  if (Object.keys(changes).length) {
    const { error } = await db().from("groups").update(changes).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? "A group with that name already exists." : /head_ids|team_lead_ids|owner_id/.test(error.message) ? MIGRATION_021 : error.message };
  }
  if (isUuid(patch.addMember)) await db().from("group_members").upsert({ group_id: id, member_id: patch.addMember });
  if (isUuid(patch.removeMember)) {
    await db().from("group_members").delete().eq("group_id", id).eq("member_id", patch.removeMember);
    // someone who leaves the group stops being its team lead
    const leads = teamLeadIdsOf(g).filter((x) => x !== patch.removeMember);
    if (leads.length !== teamLeadIdsOf(g).length) await db().from("groups").update({ team_lead_ids: leads, team_lead_id: leads[0] || null }).eq("id", id);
  }
  refreshGroups(id);
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
  updateTag("groups");
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
  updateTag("groups");
  return { ok: true };
}

/**
 * Add another phone number or email to a lead — the client sometimes gives a different one than the
 * form. The original stays as it is. type: "phone" | "email".
 */
export async function addLeadContact(leadId, type, value, label = "") {
  const me = await requireMember();
  const { data: lead } = await db().from("leads").select("id, assigned_to, extra_contacts").eq("id", leadId).maybeSingle();
  if (!lead || !canSeeLead(me, lead)) return { ok: false, error: "You can't edit this lead." };
  const v = String(value || "").trim().slice(0, 200);
  if (type === "email" ? !emailOk(v) : !/^\+?[\d\s()-]{7,20}$/.test(v)) return { ok: false, error: type === "email" ? "That email doesn't look right." : "That number doesn't look right." };
  const list = Array.isArray(lead.extra_contacts) ? lead.extra_contacts : [];
  if (list.some((c) => c.value.toLowerCase() === v.toLowerCase())) return { ok: false, error: "That one is already added." };
  const next = [...list, { type: type === "email" ? "email" : "phone", value: v, label: String(label || "").trim().slice(0, 60), by: me.name, at: new Date().toISOString() }].slice(0, 20);
  const { error } = await db().from("leads").update({ extra_contacts: next, updated_at: new Date().toISOString() }).eq("id", leadId);
  if (error) return { ok: false, error: /extra_contacts/.test(error.message) ? "Run migration 024 in Supabase first." : error.message };
  await addEvents(leadId, me.id, [{ type: "contact_added", data: { kind: type, value: v } }]);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function removeLeadContact(leadId, value) {
  const me = await requireMember();
  const { data: lead } = await db().from("leads").select("id, assigned_to, extra_contacts").eq("id", leadId).maybeSingle();
  if (!lead || !canSeeLead(me, lead)) return { ok: false, error: "You can't edit this lead." };
  const next = (Array.isArray(lead.extra_contacts) ? lead.extra_contacts : []).filter((c) => c.value !== value);
  await db().from("leads").update({ extra_contacts: next }).eq("id", leadId);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Quick search for the top bar: up to 8 leads this member can see. */
export async function searchLeads(q) {
  const me = await requireMember();
  const term = String(q || "").trim().slice(0, 80);
  if (term.length < 2) return [];
  const rows = await listLeads(me, { q: term }).catch(() => []);
  return rows.slice(0, 8).map((l) => ({ id: l.id, code: l.code, name: l.brand || [l.first_name, l.last_name].filter(Boolean).join(" "), person: [l.first_name, l.last_name].filter(Boolean).join(" "), phone: l.phone || "", status: l.status }));
}
