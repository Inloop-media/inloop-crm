import { MEETING_KINDS } from "@/lib/constants";
import { fmtDateTime, fmtMeeting } from "@/lib/format";

export const describe = (e) => {
  switch (e.type) {
    case "created":
      return e.data?.source === "website" ? "Lead came in from the website" : "Lead added";
    case "status":
      return (
        <>
          Status: {e.data?.from} → <span className="text-ink">{e.data?.to}</span>
        </>
      );
    case "assigned":
      return e.data?.to ? <>Assigned to <span className="text-ink">{e.data.to}</span></> : "Unassigned";
    case "remarks":
      return <>Remarks updated{e.data?.text ? <span className="mt-1 block whitespace-pre-wrap text-ink/80">{e.data.text}</span> : null}</>;
    case "brief":
      return <>Brief updated{e.data?.text ? <span className="mt-1 block whitespace-pre-wrap text-ink/80">{e.data.text}</span> : null}</>;
    case "meeting":
      return <>{MEETING_KINDS[e.data?.kind]?.label || "Meeting"} booked for <span className="text-ink">{fmtMeeting(e.data?.at)}</span></>;
    case "meeting_cancelled":
      return <>{MEETING_KINDS[e.data?.kind]?.label || "Meeting"} on {fmtMeeting(e.data?.at)} cancelled</>;
    case "proposal_shared":
      return "Brief shared with the creative strategists";
    case "proposal_picked":
      return <>Brief picked up by <span className="text-ink">{e.data?.to}</span></>;
    case "proposal_crl_queued":
      return "Documents sent to the CRL bot";
    case "proposal_crl_ready":
      return <>CRL ready{e.data?.url ? <a href={e.data.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-brand hover:underline">{e.data.url}</a> : null}</>;
    case "proposal_crl_failed":
      return <>CRL bot failed{e.data?.text ? <span className="mt-1 block text-rose-300/80">{e.data.text}</span> : null}</>;
    case "proposal_proposal_queued":
      return "Commercials in — proposal bot started";
    case "proposal_proposal_failed":
      return <>Proposal bot failed{e.data?.text ? <span className="mt-1 block text-rose-300/80">{e.data.text}</span> : null}</>;
    case "proposal_done":
      return <span className="text-emerald-300">Proposal deck ready</span>;
    default:
      return e.type;
  }
};

const DOT = { status: "bg-brand", assigned: "bg-cyan-400", meeting: "bg-violet-400", created: "bg-emerald-400" };

export default function Timeline({ events }) {
  if (!events.length) return <p className="text-sm text-muted">Nothing yet.</p>;
  return (
    <ol className="relative flex flex-col gap-5 pl-6 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-gradient-to-b before:from-line-strong before:to-transparent">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className={`absolute -left-6 top-1 h-[11px] w-[11px] rounded-full ring-4 ring-panel ${
              DOT[e.type] || (e.type.includes("failed") ? "bg-rose-400" : e.type.startsWith("proposal") ? "bg-fuchsia-400" : "bg-faint")
            }`}
          />
          <div className="text-sm leading-snug text-muted">{describe(e)}</div>
          <div className="mt-1 text-[11px] text-faint">
            {fmtDateTime(e.created_at)}
            {e.actor?.name ? ` · ${e.actor.name}` : ""}
          </div>
        </li>
      ))}
    </ol>
  );
}
