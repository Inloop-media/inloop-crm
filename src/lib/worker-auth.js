import "server-only";
import { timingSafeEqual } from "node:crypto";

/** The Mac worker sends WORKER_SECRET in the x-worker-secret header. */
export function workerAuthorised(request) {
  const expected = process.env.WORKER_SECRET || "";
  const given = request.headers.get("x-worker-secret") || "";
  if (expected.length < 16 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export const unauthorised = () => Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
