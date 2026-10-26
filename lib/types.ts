// Request and response types for every endpoint in API.md.
// Shared by the API (app/api) and the pages: change this file only when both sides agree.
// Dates are ISO 8601 strings. Errors come back as ApiError with a 4xx or 5xx status.

export type Role = "student" | "driver" | "admin";

export type RideStatus =
  | "requested"
  | "assigned"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "canceled"
  | "no_show";

export type ServiceMode = "automatic" | "on" | "off";

export interface ApiError {
  /** Safe to show to the user as is. */
  error: string;
}

// ---------- Auth ----------

export interface SignUpRequest {
  /** Must end in @pacific.edu or @u.pacific.edu. */
  email: string;
  /** At least 8 characters. */
  password: string;
  name: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

/** The signed-in user. Sign-up and sign-in return it along with the session cookie. */
export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface UpdateMeRequest {
  name: string;
}

// ---------- Stops and service ----------

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface ServiceStatus {
  open: boolean;
  mode: ServiceMode;
  /** When `open` next flips under the weekly rules. Null in manual mode or with no rules. */
  nextChange: string | null;
  /** The most riders one request can hold: the largest active cart's seats − 1 (1 if no cart is active). */
  maxPartySize: number;
}

export interface ServiceRule {
  id: string;
  /** 0 = Sunday ... 6 = Saturday, the day the window starts. */
  day: number;
  /** "HH:MM" in campus time. An end before the start runs past midnight. */
  start: string;
  end: string;
}

export type ServiceRuleInput = Omit<ServiceRule, "id">;

export interface SetServiceModeRequest {
  mode: ServiceMode;
}

// ---------- Rides ----------

export interface Position {
  lat: number;
  lng: number;
  at: string;
}

export interface EtaRange {
  minMinutes: number;
  maxMinutes: number;
}

/** A ride as the student sees it. */
export interface Ride {
  id: string;
  status: RideStatus;
  pickup: Stop;
  dropoff: Stop;
  partySize: number;
  requestedAt: string;
  assignedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancelReason: string | null;
  /** Null until a driver has the ride. */
  driver: { callSign: string; cartNumber: string } | null;
  /** 1 = next in line. Set only while the ride is `requested`. */
  queuePosition: number | null;
  /** Until pickup. Null when there is no driver or no fresh position. */
  eta: EtaRange | null;
  /** The student's 1–5 rating, once given. */
  rating: number | null;
}

/** A ride as drivers and admins see it. */
export interface StaffRide extends Ride {
  student: { id: string; name: string };
}

export interface CreateRideRequest {
  pickupId: string;
  dropoffId: string;
  partySize: number;
}

export interface CancelRideRequest {
  /** Required when a driver or admin cancels. */
  reason?: string;
}

export interface FeedbackRequest {
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

export interface HistoryPage {
  rides: Ride[];
  /** Pass as `?cursor=` for the next page. Null on the last page. */
  nextCursor: string | null;
}

// ---------- Drivers and carts ----------

export interface Cart {
  id: string;
  number: string;
  /** Including the driver's seat. */
  seats: number;
  active: boolean;
  /** Call sign of the driver on shift with this cart. */
  inUseBy: string | null;
}

export interface CartInput {
  number: string;
  seats: number;
  active?: boolean;
}

export interface StartShiftRequest {
  cartId: string;
}

export interface Shift {
  cart: Cart;
  startedAt: string;
}

export interface DriverQueue {
  /** Null when off shift. */
  shift: Shift | null;
  /** Rides this driver holds, oldest first. */
  mine: StaffRide[];
  /** Unclaimed rides, oldest first. Empty when off shift. */
  waiting: StaffRide[];
}

export interface PositionReport {
  lat: number;
  lng: number;
  /** Meters, from the browser's geolocation. */
  accuracy: number;
  /** When the device took the fix. */
  at: string;
}

export interface DriverPosition {
  driverId: string;
  callSign: string;
  position: Position;
}

// ---------- Admin ----------

export interface BoardDriver {
  id: string;
  name: string;
  callSign: string;
  cart: Cart;
  position: Position | null;
  /** Rides this driver holds. Empty = free. */
  rides: StaffRide[];
}

export interface AdminBoard {
  service: ServiceStatus;
  /** Requested rides, oldest first. */
  waiting: StaffRide[];
  /** Drivers on shift. */
  drivers: BoardDriver[];
}

export interface AssignRequest {
  driverId: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  suspended: boolean;
  /** Drivers only. */
  callSign: string | null;
  /** Approved points only. */
  penaltyPoints: number;
  createdAt: string;
}

export interface UpdateUserRequest {
  role?: Role;
  suspended?: boolean;
  /** Required when the role becomes driver for the first time. */
  callSign?: string;
}

export type PenaltyPointStatus = "pending" | "approved" | "rejected";

export interface PenaltyPoint {
  id: string;
  student: { id: string; name: string };
  rideId: string | null;
  reason: string;
  status: PenaltyPointStatus;
  /** Name of the driver or admin who asked for it. */
  requestedBy: string;
  createdAt: string;
}

export interface PenaltyPointRequest {
  reason: string;
}

// ---------- Notifications ----------

export type NotificationType = "ride_assigned" | "driver_arrived" | "ride_canceled" | "penalty_point";

export interface Notification {
  id: string;
  type: NotificationType;
  text: string;
  rideId: string | null;
  read: boolean;
  createdAt: string;
}
