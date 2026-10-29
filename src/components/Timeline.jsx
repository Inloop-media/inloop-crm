import { MEETING_KINDS } from "@/lib/constants";
import { fmtDateTime, fmtMeeting } from "@/lib/format";

export const describe = (e) => {
  switch (e.type) {
    case "created":
      return e.data?.source === "website" ? "Lead came in from the website" : "Lead added";
    case "status":
      return (
        <>
          Status: {e.data?.from} → <span className="text-white">{e.data?.to}</span>
        </>
      );
    case "assigned":
      return e.data?.to ? <>Assigned to <span className="text-white">{e.data.to}</span></> : "Unassigned";
    case "remarks":
      return <>Remarks updated{e.data?.text ? <span className="mt-1 block whitespace-pre-wrap text-white/80">{e.data.text}</span> : null}</>;
    case "brief":
      return <>Brief updated{e.data?.text ? <span className="mt-1 block whitespace-pre-wrap text-white/80">{e.data.text}</span> : null}</>;
    case "meeting":
      return <>{MEETING_KINDS[e.data?.kind]?.label || "Meeting"} booked for <span className="text-white">{fmtMeeting(e.data?.at)}</span></>;
    case "meeting_cancelled":
      return <>{MEETING_KINDS[e.data?.kind]?.label || "Meeting"} on {fmtMeeting(e.data?.at)} cancelled</>;
    case "proposal_shared":
      return "Brief shared with the creative strategists";
    case "proposal_picked":
      return <>Brief picked up by <span className="text-white">{e.data?.to}</span></>;
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

export default function Timeline({ events }) {
  if (!events.length) return <p className="text-sm text-muted">Nothing yet.</p>;
  return (
    <ol className="relative flex flex-col gap-5 border-l border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand ring-4 ring-panel" />
          <div className="text-sm text-muted">{describe(e)}</div>
          <div className="mt-1 text-xs text-muted/70">
            {fmtDateTime(e.created_at)}
            {e.actor?.name ? ` · ${e.actor.name}` : ""}
          </div>
        </li>
      ))}
    </ol>
  );
}
