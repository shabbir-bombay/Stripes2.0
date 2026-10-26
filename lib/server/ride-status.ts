import type { RideStatus } from "../types";

// The ride status table from API.md, as pure functions. transition.ts applies the result to the database;
// nothing else writes Ride.status.

export type Actor = "student" | "driver" | "admin";

/** For each target status: the statuses it may come from, and who may make the move. */
export const MOVES: Record<RideStatus, { from: RideStatus[]; by: Actor[] }> = {
  requested: { from: ["assigned", "en_route", "arrived"], by: ["admin"] },
  assigned: { from: ["requested"], by: ["driver", "admin"] },
  en_route: { from: ["assigned"], by: ["driver"] },
  arrived: { from: ["assigned", "en_route"], by: ["driver"] },
  in_progress: { from: ["arrived"], by: ["driver"] },
  completed: { from: ["in_progress"], by: ["driver"] },
  no_show: { from: ["arrived"], by: ["driver"] },
  canceled: { from: ["requested", "assigned", "en_route", "arrived"], by: ["student", "driver", "admin"] },
};

export const FINAL: RideStatus[] = ["completed", "canceled", "no_show"];

export const STUDENT_CANCEL_REASON = "Canceled by student";

/** The fields a move writes, besides `status`. `null` clears a field; a missing key leaves it alone. */
export interface RidePatch {
  driverId?: string | null;
  assignedAt?: Date | null;
  arrivedAt?: Date | null;
  startedAt?: Date;
  endedAt?: Date;
  cancelReason?: string;
}

export interface MoveRequest {
  to: RideStatus;
  by: Actor;
  /** The driver who gets the ride. Required for `assigned`. */
  driverId?: string;
  /** Required when a driver or admin cancels. */
  reason?: string;
  now?: Date;
}

export type MovePlan = { ok: true; patch: RidePatch } | { ok: false; status: 400 | 403 | 409; error: string };

/** Whether the status table allows this move at all. */
export function canMove(from: RideStatus, to: RideStatus, by: Actor) {
  const move = MOVES[to];
  return move.from.includes(from) && move.by.includes(by);
}

/** Checks a move against the status table and works out what it writes. */
export function planMove(from: RideStatus, { to, by, driverId, reason, now = new Date() }: MoveRequest): MovePlan {
  if (!MOVES[to].by.includes(by)) return { ok: false, status: 403, error: "You can't make this change to a ride." };
  if (!MOVES[to].from.includes(from)) return { ok: false, status: 409, error: conflictMessage(from) };

  switch (to) {
    case "assigned":
      if (!driverId) return { ok: false, status: 400, error: "Choose a driver." };
      return { ok: true, patch: { driverId, assignedAt: now } };
    case "requested":
      return { ok: true, patch: { driverId: null, assignedAt: null, arrivedAt: null } };
    case "arrived":
      return { ok: true, patch: { arrivedAt: now } };
    case "in_progress":
      return { ok: true, patch: { startedAt: now } };
    case "completed":
    case "no_show":
      return { ok: true, patch: { endedAt: now } };
    case "canceled": {
      const text = reason?.trim();
      if (by !== "student" && !text) return { ok: false, status: 400, error: "Give a reason for canceling." };
      if (text && text.length > 200) return { ok: false, status: 400, error: "Keep the reason under 200 characters." };
      return { ok: true, patch: { endedAt: now, cancelReason: text || STUDENT_CANCEL_REASON } };
    }
    default:
      return { ok: true, patch: {} };
  }
}

function conflictMessage(from: RideStatus) {
  if (FINAL.includes(from)) return `This ride is already ${from === "no_show" ? "marked as a no-show" : from}.`;
  if (from === "in_progress") return "This ride is already under way.";
  return "This ride has changed. Refresh and try again.";
}
