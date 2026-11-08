import type { PenaltyPoint, PenaltyPointStatus } from "../types";
import type { Prisma } from "./generated/prisma/client";

export const PENALTY_STATUSES: PenaltyPointStatus[] = ["pending", "approved", "rejected"];

/** The endpoints `/api/admin/penalty-points/:id/<action>` and the status each one sets. */
export const PENALTY_DECISIONS: Record<string, PenaltyPointStatus> = { approve: "approved", reject: "rejected" };

/** The spec's limit on a typed reason. */
const MAX_REASON = 200;

export function parseReason(value: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason) return { ok: false, error: "Give a reason." };
  if (reason.length > MAX_REASON) return { ok: false, error: `Keep the reason under ${MAX_REASON} characters.` };
  return { ok: true, reason };
}

/** Everything `toPenaltyPoint` needs. */
export const penaltyInclude = {
  student: { select: { id: true, name: true } },
  requestedBy: { select: { name: true, role: true, driver: { select: { callSign: true } } } },
} satisfies Prisma.PenaltyPointInclude;

type PenaltyRow = Prisma.PenaltyPointGetPayload<{ include: typeof penaltyInclude }>;

/** A call sign is the only driver identity a student sees, so a student's own view never carries a staff name. */
export function toPenaltyPoint(row: PenaltyRow, viewer: "staff" | "student"): PenaltyPoint {
  const { requestedBy } = row;
  return {
    id: row.id,
    student: row.student,
    rideId: row.rideId,
    reason: row.reason,
    status: row.status,
    requestedBy: !requestedBy
      ? "A deleted account"
      : viewer === "staff"
        ? requestedBy.name
        : requestedBy.role === "admin"
          ? "An admin"
          : (requestedBy.driver?.callSign ?? "A driver"),
    createdAt: row.createdAt.toISOString(),
  };
}
