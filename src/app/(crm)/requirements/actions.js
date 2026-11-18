"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { createRequirement, updateRequirement } from "@/lib/requirements";

const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

export async function addRequirement(input) {
  const me = await requireMember();
  const r = await createRequirement(me, input || {});
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function changeRequirement(id, change) {
  const me = await requireMember();
  if (!isUuid(id)) return { ok: false, error: "Invalid request." };
  if (change?.forward && !isUuid(change.forward)) return { ok: false, error: "Pick someone." };
  const r = await updateRequirement(me, id, change || {});
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
