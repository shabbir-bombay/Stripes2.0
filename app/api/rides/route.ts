import { fail, readBody, requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { ACTIVE } from "@/lib/server/ride-status";
import { isUniqueViolation, isUuid, studentRide } from "@/lib/server/rides";
import { serviceStatus } from "@/lib/server/service";

const ALREADY_RIDING = "You already have a ride. Cancel it to request another.";

export async function POST(request: Request) {
  const user = await requireUser("student");
  if (user instanceof Response) return user;

  const { pickupId, dropoffId, partySize } = (await readBody(request)) ?? {};
  if (!isUuid(pickupId) || !isUuid(dropoffId)) return fail(400, "Choose a pickup and a drop-off.");
  if (pickupId === dropoffId) return fail(400, "Pick a drop-off that isn't your pickup.");

  const service = await serviceStatus();
  if (!Number.isInteger(partySize) || (partySize as number) < 1 || (partySize as number) > service.maxPartySize) {
    return fail(400, `Riders must be from 1 to ${service.maxPartySize}.`);
  }
  const stops = await db.stop.count({ where: { id: { in: [pickupId, dropoffId] }, active: true } });
  if (stops !== 2) return fail(400, "That stop isn't available. Choose another.");
  if (!service.open) return fail(409, "Stripes is closed right now.");
  if (await db.ride.findFirst({ where: { studentId: user.id, status: { in: ACTIVE } } })) return fail(409, ALREADY_RIDING);

  try {
    const { id } = await db.ride.create({
      data: { studentId: user.id, pickupId, dropoffId, partySize: partySize as number },
    });
    return Response.json(await studentRide(id), { status: 201 });
  } catch (error) {
    // Two requests at once: the partial unique index lets only one through.
    if (isUniqueViolation(error)) return fail(409, ALREADY_RIDING);
    throw error;
  }
}
