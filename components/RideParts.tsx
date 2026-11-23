import type { RideStatus } from "@/lib/types";

const STEPS = ["Requested", "On the way", "Here", "On board"];

const STEP: Partial<Record<RideStatus, number>> = { requested: 1, assigned: 2, en_route: 2, arrived: 3, in_progress: 4 };

/** Where the ride is, in four steps, the same on every ride screen. */
export function RideSteps({ status }: { status: RideStatus }) {
  const step = STEP[status] ?? 4;
  return (
    <div>
      <div className="ride-steps-bar" aria-hidden="true">
        {STEPS.map((name, i) => <span key={name} className={i < step ? "done" : undefined} />)}
      </div>
      <ol className="ride-steps-labels" aria-label="Ride progress">
        {STEPS.map((name, i) => (
          <li key={name} aria-current={i + 1 === step ? "step" : undefined}>
            {name}
            {i + 1 < step && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Pickup and drop-off, joined by a line. */
export function RouteStops({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <div className="route">
      <div className="route-marks" aria-hidden="true">
        <span className="mark-pickup" />
        <span className="mark-line" />
        <span className="mark-dropoff" />
      </div>
      <dl>
        <dt>Pickup</dt>
        <dd>{pickup}</dd>
        <dt>Drop-off</dt>
        <dd>{dropoff}</dd>
      </dl>
    </div>
  );
}

/** The cart number, like a license plate. The text reads "Cart 1" to a screen reader. */
export function CartPlate({ number, size }: { number: string; size?: "large" | "compact" }) {
  return (
    <span className={size ? `plate ${size}` : "plate"} role="img" aria-label={`Cart ${number}`}>
      <small aria-hidden="true">CART</small>
      <b aria-hidden="true">{number}</b>
    </span>
  );
}

export const riders = (count: number) => (count === 1 ? "1 rider" : `${count} riders`);

/** "3:53 PM" in campus time. */
export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });
}

/** Whole minutes from `iso` to now, never below 0. */
export function minutesSince(iso: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}

/** "Sam" from "Sam Student". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
