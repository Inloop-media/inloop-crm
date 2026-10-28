import "server-only";
import { db } from "@/lib/supabase/server";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const isCalendarConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export class CalendarError extends Error {
  constructor(message, { reconnect = false } = {}) {
    super(message);
    this.reconnect = reconnect;
  }
}

/** Fresh access token for a member from their saved refresh token. */
async function accessToken(memberId) {
  if (!isCalendarConfigured()) throw new CalendarError("Google Calendar isn't set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see SETUP.md).");
  const { data: m } = await db().from("members").select("google_refresh_token").eq("id", memberId).maybeSingle();
  if (!m?.google_refresh_token) throw new CalendarError("Connect your Google Calendar first.", { reconnect: true });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: m.google_refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      // Access was revoked or expired — forget it so the member is asked to reconnect
      await db().from("members").update({ google_refresh_token: null, calendar_connected_at: null }).eq("id", memberId);
      throw new CalendarError("Your Google Calendar connection expired. Connect it again.", { reconnect: true });
    }
    throw new CalendarError(`Google sign-in failed (${data.error || res.status}).`);
  }
  return data.access_token;
}

/** Calendar event with a Google Meet link, created in the organiser's calendar. Invites go out by email. */
export async function createMeetEvent(memberId, { summary, description, start, end, attendees }) {
  const token = await accessToken(memberId);
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: start.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Kolkata" },
        attendees: attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
      cache: "no-store",
    }
  );
  const event = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new CalendarError("Google Calendar refused the request. Connect your calendar again.", { reconnect: true });
    }
    throw new CalendarError(`Couldn't create the calendar event (${event.error?.message || res.status}).`);
  }
  const link =
    event.hangoutLink ||
    (event.conferenceData?.entryPoints || []).map((p) => p.uri).find((u) => /meet\.google/.test(u)) ||
    event.htmlLink ||
    "";
  return { eventId: event.id, link };
}

/** Cancels the event and emails the guests. A missing event counts as already cancelled. */
export async function cancelEvent(memberId, eventId) {
  if (!eventId) return;
  const token = await accessToken(memberId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new CalendarError(`Couldn't cancel the calendar event (${res.status}).`);
  }
}
