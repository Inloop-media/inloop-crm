"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { cancelTeamMeeting, createTeamMeeting } from "@/lib/teamMeetings";

/** A team lead / manager / CBO / admin books a team meeting (groups and/or people). */
export async function scheduleTeamMeeting(input) {
  const me = await requireMember();
  const r = await createTeamMeeting(me, input && typeof input === "object" ? input : {});
  if (r.ok) revalidatePath("/");
  return r;
}

export async function cancelMeeting(id) {
  const me = await requireMember();
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return { ok: false, error: "Meeting not found." };
  const r = await cancelTeamMeeting(me, id);
  if (r.ok) revalidatePath("/");
  return r;
}
