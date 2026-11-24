const EMAIL = "tech@inloopmedia.com";

export const metadata = {
  title: "Privacy Policy | Inloop Media",
  description: "How Inloop Media handles information on its website and in its internal tools.",
};

const SECTIONS = [
  [
    "Who we are",
    "Inloop Media is a creative agency. This policy covers loop, the Inloop Media CRM (inloophub.com), the internal tool our team and clients sign in to, and our website.",
  ],
  [
    "What we collect",
    "When you fill in a form on our website we keep the details you give us — such as your name, email, phone number, company and message — so we can reply. When a team member or client signs in with Google, we receive their name, email address and profile picture from Google. If a team member connects Google Calendar, we use it only to create and manage the meetings they schedule from the CRM.",
  ],
  [
    "How we use it",
    "We use this information to respond to enquiries, run our client work, manage tasks and meetings for our team, and keep our tools secure. We do not sell your information, and we do not use Google user data for advertising.",
  ],
  [
    "Google user data",
    "Information received from Google APIs is used only to sign you in and, if you choose, to schedule meetings on your Google Calendar. Our use of that information follows the Google API Services User Data Policy, including its Limited Use requirements. You can remove our access at any time from your Google Account's security settings.",
  ],
  [
    "Who we share it with",
    "We share information only with the service providers that host and run our website and tools (for example our hosting and database providers), and only as needed to provide the service, or when the law requires it.",
  ],
  [
    "How long we keep it",
    "We keep information for as long as we need it for the purposes above, or as required by law. You can ask us to delete your information at any time.",
  ],
  ["Your choices", `To see, correct or delete the information we hold about you, write to us at ${EMAIL}.`],
];

export default function PrivacyPage() {
  return (
    <main className="min-h-svh bg-bg text-ink">
      <div className="mx-auto max-w-[860px] px-6 pb-24 pt-16 md:px-10">
        <p className="text-[12px] uppercase tracking-[3px] text-muted">Legal</p>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.15] tracking-[-0.02em] md:text-[48px]">Privacy Policy</h1>
        <p className="mt-4 text-[14px] text-muted">Last updated: 20 November 2026</p>
        <div className="mt-14 flex flex-col gap-10">
          {SECTIONS.map(([h, body]) => (
            <section key={h}>
              <h2 className="text-[20px] font-medium leading-[1.4]">{h}</h2>
              <p className="mt-3 text-[16px] leading-7 text-ink/80">{body}</p>
            </section>
          ))}
          <section>
            <h2 className="text-[20px] font-medium leading-[1.4]">Contact</h2>
            <p className="mt-3 text-[16px] leading-7 text-ink/80">
              Inloop Media ·{" "}
              <a href={`mailto:${EMAIL}`} className="underline underline-offset-4 hover:text-ink">
                {EMAIL}
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
