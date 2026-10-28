// Text the client sees in calendar invites — same wording as the Google Sheets CRM.

export function discoveryMessage({ firstName, brand, service, sender }) {
  const help = service && !/not sure/i.test(service) ? ` with ${service}` : "";
  return [
    `Hi ${firstName || "there"},`,
    "",
    `Thank you for reaching out to Inloop Media. We're excited to learn more about ${brand || "your brand"} and how we can help${help}.`,
    "",
    "On this call we'll understand your goals, walk you through how we work, and answer any questions you may have.",
    "",
    "Looking forward to speaking with you.",
    "",
    "Warm regards,",
    sender ? `${sender}\nInloop Media` : "Team Inloop Media",
  ].join("\n");
}

export function proposalMessage({ firstName, brand, sender }) {
  return [
    `Hi ${firstName || "there"},`,
    "",
    `Thank you for sharing your brief with us. As a next step, we'd love to go deeper into your goals for ${brand || "your brand"}.`,
    "",
    "On this call we'll walk you through our thinking and how we would approach your brief.",
    "",
    "Looking forward to speaking with you.",
    "",
    "Warm regards,",
    sender ? `${sender}\nInloop Media` : "Team Inloop Media",
  ].join("\n");
}
