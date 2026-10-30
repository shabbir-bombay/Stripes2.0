import type { ReactNode } from "react";
import type { RideStatus, StaffRide } from "@/lib/types";

const STATUS: Partial<Record<RideStatus, string>> = {
  requested: "Waiting",
  assigned: "Claimed",
  en_route: "On the way",
  arrived: "At pickup",
  in_progress: "Riding",
};

/** A ride for drivers and admins: where from and to, who, how many, and how long they've waited. Actions go in `children`. */
export function RideCard({ ride, children }: { ride: StaffRide; children?: ReactNode }) {
  const waited = Math.max(0, Math.floor((Date.now() - Date.parse(ride.requestedAt)) / 60_000));
  return (
    <article className="card ride-card">
      <p className="ride-status">
        {ride.status === "requested" ? `#${ride.queuePosition} in line` : STATUS[ride.status]} · {waited} min since request
      </p>
      <dl className="summary">
        <dt>From</dt>
        <dd>{ride.pickup.name}</dd>
        <dt>To</dt>
        <dd>{ride.dropoff.name}</dd>
        <dt>Rider</dt>
        <dd>
          {ride.student.name}
          {ride.partySize > 1 && ` + ${ride.partySize - 1}`}
        </dd>
      </dl>
      {children}
    </article>
  );
}
