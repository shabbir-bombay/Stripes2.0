import type { NotificationType } from "../types";
import type { Actor } from "./ride-status";

// What each ride change tells people, as a pure function. transition() writes these in the same
// database transaction as the status change, so a notice exists exactly when the change does.

export interface Notice {
  userId: string;
  type: NotificationType;
  text: string;
}

export interface NoticeRide {
  studentId: string;
  /** The driver holding the ride before this move. */
  driverId: string | null;
  pickupName: string;
}

export interface NoticeMove {
  to: string;
  by: Actor;
  /** Who gets the ride, when the move is to `assigned`. */
  driver?: { id: string; callSign: string; cartNumber: string | null };
  /** The reason saved on the ride, when the move is to `canceled`. */
  reason?: string;
}

/** Nobody is told about their own action. A student's own cancel only tells the driver, and so on. */
export function rideNotices(ride: NoticeRide, move: NoticeMove): Notice[] {
  const { to, by } = move;
  const from = `the ride from ${ride.pickupName}`;

  if (to === "assigned" && move.driver) {
    const { id, callSign, cartNumber } = move.driver;
    const cart = cartNumber ? ` Look for Cart ${cartNumber}.` : "";
    const notices: Notice[] = [{ userId: ride.studentId, type: "ride_assigned", text: `${callSign} has your ride.${cart}` }];
    if (by === "admin") notices.push({ userId: id, type: "ride_assigned", text: `An admin gave you ${from}.` });
    return notices;
  }

  if (to === "arrived") {
    return [{ userId: ride.studentId, type: "driver_arrived", text: `Your cart is at ${ride.pickupName}.` }];
  }

  if (to === "canceled") {
    const notices: Notice[] = [];
    if (by !== "student") {
      notices.push({ userId: ride.studentId, type: "ride_canceled", text: `Your ride from ${ride.pickupName} was canceled: ${move.reason}` });
    }
    if (by !== "driver" && ride.driverId) {
      notices.push({
        userId: ride.driverId,
        type: "ride_canceled",
        text: by === "student" ? `The student canceled ${from}.` : `An admin canceled ${from}: ${move.reason}`,
      });
    }
    return notices;
  }

  return [];
}

/** Tells a student their penalty point now counts. */
export function penaltyNotice(studentId: string, reason: string): Notice {
  return { userId: studentId, type: "penalty_point", text: `A penalty point was added to your account: ${reason}` };
}
