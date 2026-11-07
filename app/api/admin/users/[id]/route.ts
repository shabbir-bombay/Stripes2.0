import { parseUserUpdate, planUserUpdate } from "@/lib/server/accounts";
import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ACTIVE, HELD } from "@/lib/server/ride-status";
import { isUniqueViolation, isUuid } from "@/lib/server/rides";
import { toUser, userInclude } from "@/lib/server/users";

const NOT_FOUND = "No such account.";

/** Change a role, suspend or reinstate, or set a driver's call sign. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/admin/users/[id]">) {
  const admin = await requireUser("admin");
  if (admin instanceof Response) return admin;

  const { id } = await params;
  if (!isUuid(id)) return fail(404, NOT_FOUND);
  const parsed = parseUserUpdate(await readBody(request));
  if (!parsed.ok) return fail(400, parsed.error);

  const target = await db.user.findUnique({ where: { id }, include: { driver: { select: { callSign: true, cartId: true } } } });
  if (!target) return fail(404, NOT_FOUND);
  const [ridesAsStudent, ridesAsDriver] = await Promise.all([
    db.ride.count({ where: { studentId: id, status: { in: ACTIVE } } }),
    db.ride.count({ where: { driverId: id, status: { in: HELD } } }),
  ]);

  const plan = planUserUpdate(
    {
      id,
      name: target.name,
      role: target.role,
      suspended: target.suspended,
      callSign: target.driver?.callSign ?? null,
      onShift: !!target.driver?.cartId,
      ridesAsStudent,
      ridesAsDriver,
    },
    admin.id,
    parsed.value,
  );
  if (!plan.ok) return fail(plan.status, plan.error);
  const { user, callSign, endShift } = plan;

  try {
    const blocked = await db.$transaction(async (tx) => {
      if (endShift) {
        // One conditional update, so a ride claimed a moment ago still blocks it, as when a driver ends their own shift.
        const { count } = await tx.driverProfile.updateMany({
          where: { userId: id, rides: { none: { status: { in: HELD } } } },
          data: { cartId: null, shiftStart: null, lat: null, lng: null, positionAt: null },
        });
        if (count === 0) return fail(409, `${target.name} just got a ride. Reassign or cancel it first.`);
      }
      if (callSign !== undefined) {
        await tx.driverProfile.upsert({ where: { userId: id }, update: { callSign }, create: { userId: id, callSign } });
      }
      await tx.user.update({ where: { id }, data: user });
      return null;
    });
    if (blocked) return blocked;
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, `The call sign ${callSign} is taken. Choose another.`);
    throw error;
  }

  return Response.json(toUser(await db.user.findUniqueOrThrow({ where: { id }, include: userInclude })));
}
