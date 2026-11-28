// Team meetings: the ones you're in, and "Schedule" for team leads and up (moved off the dashboards).
import { requireMember } from "@/lib/auth";
import { PageTop } from "@/components/Desk";
import TeamMeetings from "@/components/TeamMeetings";
import { canCallMeetings, meetingAudience, myTeamMeetings } from "@/lib/teamMeetings";

const nowMs = () => Date.now();

export const metadata = { title: "Meetings" };

export default async function MeetingsPage() {
  const me = await requireMember();
  const [meetings, audience] = await Promise.all([myTeamMeetings(me.id).catch(() => []), canCallMeetings(me) ? meetingAudience(me) : null]);
  return (
    <div className="page">
      <PageTop title="Meetings" sub="Team meetings you're in — the Meet link and invite go to your Google Calendar." />
      <div className="rise max-w-3xl">
        <TeamMeetings meetings={meetings} audience={audience} connected={Boolean(me.calendar_connected_at)} domain={process.env.ALLOWED_DOMAIN} now={nowMs()} />
      </div>
    </div>
  );
}
