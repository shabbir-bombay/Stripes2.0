import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { penaltyInclude, toPenaltyPoint } from "@/lib/server/penalty";

/** The student's own approved points, newest first. Pending and rejected ones stay hidden. */
export async function GET() {
  const user = await requireUser("student");
  if (user instanceof Response) return user;

  const rows = await db.penaltyPoint.findMany({
    where: { studentId: user.id, status: "approved" },
    include: penaltyInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return Response.json(rows.map((row) => toPenaltyPoint(row, "student")));
}
