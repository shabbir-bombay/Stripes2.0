import type { User } from "../types";
import type { Prisma } from "./generated/prisma/client";

/** Everything `toUser` needs. */
export const userInclude = {
  driver: { select: { callSign: true } },
  _count: { select: { penaltyPoints: { where: { status: "approved" } } } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    suspended: row.suspended,
    // A former driver keeps a profile for old rides, but only a current driver has a call sign to show.
    callSign: row.role === "driver" ? (row.driver?.callSign ?? null) : null,
    penaltyPoints: row._count.penaltyPoints,
    createdAt: row.createdAt.toISOString(),
  };
}
