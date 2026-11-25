"use server";

import { revalidatePath } from "next/cache";
import { pingLive } from "@/lib/live";
import { requireMember } from "@/lib/auth";
import { createRequirement, markRequirementSeen, reqUploadUrl, updateRequirement } from "@/lib/requirements";

const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

export async function addRequirement(input) {
  const me = await requireMember();
  const r = await createRequirement(me, input || {});
  if (r.ok) {
    revalidatePath("/", "layout");
    pingLive("requirements");
  }
  return r;
}

export async function changeRequirement(id, change) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Invalid request." };
  if (change?.forward && !isUuid(change.forward)) return { ok: false, error: "Pick someone." };
  const r = await updateRequirement(me, id, change || {});
  if (r.ok) {
    revalidatePath("/", "layout");
    pingLive("requirements");
  }
  return r;
}

/** Signed upload URL for a file the receiver sends back with a requirement. */
export async function requirementUploadUrl(id, name, size) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Invalid request." };
  return reqUploadUrl(me, id, name, Number(size) || 0);
}

/** Opened a requirement: its replies / updates stop counting in the sidebar. */
export async function seenRequirement(id) {
  const me = await requireMember();
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return { ok: false };
  await markRequirementSeen(me, id).catch(() => {});
  revalidatePath("/requirements");
  return { ok: true };
}
