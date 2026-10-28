import "server-only";

/** Link to a page in the CRM, when CRM_URL is set (e.g. https://crm.inloopmedia.com). */
export const crmLink = (path, label) => {
  const base = String(process.env.CRM_URL || "").replace(/\/$/, "");
  return base ? `<${base}${path}|${label}>` : label;
};

/** One-line pipeline update in the Slack channel. Never throws. */
export async function notify(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
    });
    return res.ok;
  } catch (err) {
    console.error("Slack post failed:", err);
    return false;
  }
}
