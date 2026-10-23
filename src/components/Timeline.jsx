import { fmtDateTime } from "@/lib/format";

const describe = (e) => {
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
          <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand" />
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
