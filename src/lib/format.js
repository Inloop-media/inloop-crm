const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });

export const fmtDateTime = (d) => (d ? dateTime.format(new Date(d)) : "—");
export const fmtDay = (d) => (d ? dateOnly.format(new Date(d)) : "—");
export const fullName = (l) => [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";

const meetingFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
export const fmtMeeting = (d) => (d ? meetingFmt.format(new Date(d)) : "—");

/** Calendar day in India time, "2026-10-28" — used to bucket leads by day. */
export const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** "3h ago", "2d ago" */
export function ago(d) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
