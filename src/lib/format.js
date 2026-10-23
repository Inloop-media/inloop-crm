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
