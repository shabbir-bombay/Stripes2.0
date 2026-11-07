import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { penaltyNotice } from "@/lib/server/notifications";
import { parseReason, PENALTY_STATUSES, penaltyInclude, toPenaltyPoint } from "@/lib/server/penalty";
import { isUuid } from "@/lib/server/rides";
import type { PenaltyPointStatus } from "@/lib/types";

const LIMIT = 100;

/** Up to 100 points. Pending ones come oldest first, so the longest wait is on top; decided ones newest first. */
export async function GET(request: Request) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const status = new URL(request.url).searchParams.get("status") || undefined;
  if (status && !PENALTY_STATUSES.includes(status as PenaltyPointStatus)) return fail(400, "Status must be pending, approved or rejected.");

  const direction = status === "pending" ? "asc" : "desc";
  const rows = await db.penaltyPoint.findMany({
    where: status ? { status: status as PenaltyPointStatus } : undefined,
    include: penaltyInclude,
    orderBy: [{ createdAt: direction }, { id: direction }],
    take: LIMIT,
  });
  return Response.json(rows.map((row) => toPenaltyPoint(row, "staff")));
}

/** An admin's own point counts at once, and tells the student. */
export async function POST(request: Request) {
  const user = await requireUser("admin");
  if (user instanceof Response) return user;

  const body = await readBody(request);
  const studentId = body?.studentId;
  if (!isUuid(studentId)) return fail(400, "Choose a student.");
  const parsed = parseReason(body?.reason);
  if (!parsed.ok) return fail(400, parsed.error);

  const student = await db.user.findUnique({ where: { id: studentId } });
  if (student?.role !== "student") return fail(404, "No such student.");

  const row = await db.$transaction(async (tx) => {
    await tx.notification.create({ data: penaltyNotice(studentId, parsed.reason) });
    return tx.penaltyPoint.create({
      data: { studentId, reason: parsed.reason, status: "approved", requestedById: user.id, decidedById: user.id, decidedAt: new Date() },
      include: penaltyInclude,
    });
  });
  return Response.json(toPenaltyPoint(row, "staff"), { status: 201 });
}
