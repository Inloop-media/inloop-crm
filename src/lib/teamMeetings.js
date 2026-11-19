import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/server";
import { pushTo } from "@/lib/push";
import { dmContacts } from "@/lib/dm";
import { cancelEvent, createMeetEvent } from "@/lib/google";
import { runsGroup, teamLeadIdsOf } from "@/lib/groups";

// Team meetings: a team lead, a manager, a CBO or admin / ops books a Google Meet from their dashboard —
// with whole groups (every person in them is invited one by one) and/or individual people (one-on-one).
// The meeting is created on the organizer's Google Calendar, so every guest gets the invite + Meet link
// on their own email, and it shows on each guest's dashboard (and the organizer's).

const isStaff = (m) => m.role === "admin" || m.role === "ops";
const MIGRATION = "Team meetings need migration 022 — run it in Supabase first.";

/** Groups `me` may call a meeting for (with who is in them) and the people they may invite one-on-one. */
export async function meetingAudience(me) {
  const { data: all, error } = await db().from("groups").select("*, group_members(member:members(id, name, active))").order("name");
  if (error) return { groups: [], people: [] };
  const mine = (all || []).filter((g) => isStaff(me) || runsGroup(g, me.id) || teamLeadIdsOf(g).includes(me.id));
  const groups = mine.map((g) => ({
    id: g.id,
    name: g.name,
    people: (g.group_members || []).map((x) => x.member).filter((m) => m?.active && m.id !== me.id).map((m) => ({ id: m.id, name: m.name })),
  }));
  const byId = new Map();
  for (const g of groups) for (const p of g.people) byId.set(p.id, p);
  for (const c of await dmContacts(me)) if (!byId.has(c.id)) byId.set(c.id, { id: c.id, name: c.name });
  const people = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { groups: groups.filter((g) => g.people.length), people };
}

/** Team leads, managers, CBOs and admin / ops can book team meetings. */
export const canCallMeetings = (me) => isStaff(me) || (me.ledGroups || []).length > 0 || (me.leadGroups || []).length > 0;

/**
 * Books it. input: { title, agenda, when ("2026-11-20T15:30", India time), minutes, groupIds, memberIds }.
 * Returns { ok, error, reconnect }.
 */
export async function createTeamMeeting(me, input) {
  if (!canCallMeetings(me)) return { ok: false, error: "Only team leads, managers and CBOs can call team meetings." };
  const title = String(input.title || "").trim().slice(0, 200);
  const agenda = String(input.agenda || "").trim().slice(0, 4000);
  const minutes = Math.min(480, Math.max(10, Number(input.minutes) || 30));
  if (!title) return { ok: false, error: "Give the meeting a title." };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input.when || ""))) return { ok: false, error: "Pick a date and time." };
  const start = new Date(`${input.when}:00+05:30`);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 5 * 60e3) return { ok: false, error: "Pick a time in the future." };
  const end = new Date(start.getTime() + minutes * 60e3);

  // Only groups / people this person may invite
  const audience = await meetingAudience(me);
  const groupIds = [...new Set((input.groupIds || []).map(String))].filter((id) => audience.groups.some((g) => g.id === id));
  const allowed = new Set(audience.people.map((p) => p.id));
  const ids = new Set((input.memberIds || []).map(String).filter((id) => allowed.has(id)));
  for (const g of audience.groups) if (groupIds.includes(g.id)) for (const p of g.people) ids.add(p.id);
  ids.delete(me.id);
  if (!ids.size) return { ok: false, error: "Pick a group or at least one person." };

  const { data: people } = await db().from("members").select("id, name, email, active").in("id", [...ids]);
  const guests = (people || []).filter((p) => p.active && p.email);
  if (!guests.length) return { ok: false, error: "No one to invite." };

  const groupNames = audience.groups.filter((g) => groupIds.includes(g.id)).map((g) => g.name);
  let event;
  try {
    event = await createMeetEvent(me.id, {
      summary: title,
      description: [agenda, `Called by ${me.name}${groupNames.length ? ` · ${groupNames.join(", ")}` : ""} on Inloop.`].filter(Boolean).join("\n\n"),
      start,
      end,
      attendees: guests.map((g) => g.email),
    });
  } catch (err) {
    return { ok: false, error: err.message || "Couldn't reach Google Calendar.", reconnect: Boolean(err.reconnect) };
  }

  const { data: row, error } = await db()
    .from("team_meetings")
    .insert({ title, agenda, starts_at: start.toISOString(), ends_at: end.toISOString(), organizer_id: me.id, group_ids: groupIds, meet_link: event.link, event_id: event.eventId })
    .select("id")
    .single();
  if (error) {
    await cancelEvent(me.id, event.eventId).catch(() => {});
    return { ok: false, error: /team_meetings/.test(error.message) ? MIGRATION : error.message };
  }
  await db().from("team_meeting_people").insert(guests.map((g) => ({ meeting_id: row.id, member_id: g.id })));

  const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(start);
  after(() => pushTo(guests.map((g) => g.id), { title: `📅 ${me.name} called a meeting`, body: `${title} · ${when}`, url: "/", tag: `meet-${row.id}` }));
  return { ok: true, id: row.id, invited: guests.length };
}

/** Upcoming (and just-started) meetings this person organises or is invited to, soonest first. */
export async function myTeamMeetings(meId) {
  const since = new Date(Date.now() - 60 * 60e3).toISOString();
  const [{ data: invited, error }, { data: organised }] = await Promise.all([
    db().from("team_meeting_people").select("meeting_id").eq("member_id", meId),
    db().from("team_meetings").select("id").eq("organizer_id", meId).gte("ends_at", since),
  ]);
  if (error) return [];
  const ids = [...new Set([...(invited || []).map((r) => r.meeting_id), ...(organised || []).map((r) => r.id)])];
  if (!ids.length) return [];
  const { data } = await db()
    .from("team_meetings")
    .select("id, title, agenda, starts_at, ends_at, meet_link, group_ids, organizer_id, cancelled_at, organizer:members!team_meetings_organizer_id_fkey(name), team_meeting_people(member:members(id, name))")
    .in("id", ids)
    .is("cancelled_at", null)
    .gte("ends_at", since)
    .order("starts_at")
    .limit(20);
  const groupIds = [...new Set((data || []).flatMap((m) => m.group_ids || []))];
  const { data: groups } = groupIds.length ? await db().from("groups").select("id, name").in("id", groupIds) : { data: [] };
  const gName = Object.fromEntries((groups || []).map((g) => [g.id, g.name]));
  return (data || []).map((m) => ({
    id: m.id,
    title: m.title,
    agenda: m.agenda,
    starts_at: m.starts_at,
    ends_at: m.ends_at,
    meet_link: m.meet_link,
    mine: m.organizer_id === meId,
    organizer: m.organizer?.name || "",
    groups: (m.group_ids || []).map((id) => gName[id]).filter(Boolean),
    people: (m.team_meeting_people || []).map((p) => p.member?.name).filter(Boolean),
  }));
}

/** The organizer (or admin) cancels it; Google emails everyone. */
export async function cancelTeamMeeting(me, id) {
  const { data: m } = await db().from("team_meetings").select("id, organizer_id, event_id, title, team_meeting_people(member_id)").eq("id", id).maybeSingle();
  if (!m) return { ok: false, error: "Meeting not found." };
  if (m.organizer_id !== me.id && me.role !== "admin") return { ok: false, error: "Only the person who called it can cancel it." };
  try {
    await cancelEvent(m.organizer_id, m.event_id);
  } catch (err) {
    return { ok: false, error: err.message || "Couldn't cancel it on Google Calendar." };
  }
  await db().from("team_meetings").update({ cancelled_at: new Date().toISOString() }).eq("id", id);
  after(() => pushTo((m.team_meeting_people || []).map((p) => p.member_id), { title: `❌ Meeting cancelled`, body: m.title, url: "/", tag: `meet-${id}` }));
  return { ok: true };
}
