// Sample responses for building pages before their endpoint exists (see API.md).
// Typed against lib/types.ts, so a contract change shows up here as a type error.
import type { AdminBoard, Cart, DriverQueue, Me, Notification, Ride, ServiceStatus, StaffRide, Stop } from "./types";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const stops: Stop[] = [
  { id: "stop-burns", name: "Burns Tower", lat: 37.98081969, lng: -121.3085353 },
  { id: "stop-derosa", name: "DeRosa University Center", lat: 37.98170764, lng: -121.3118559 },
  { id: "stop-library", name: "William Knox Holt Memorial Library", lat: 37.97957444, lng: -121.3092595 },
  { id: "stop-baun", name: "Baun Student Fitness Center", lat: 37.98057657, lng: -121.312961 },
  { id: "stop-monagan", name: "Monagan Hall", lat: 37.98355537, lng: -121.3141948 },
  { id: "stop-chambers", name: "John Chambers Technology Center", lat: 37.97888627, lng: -121.3110995 },
];

export const me: Record<Me["role"], Me> = {
  student: { id: "user-student", email: "student@u.pacific.edu", name: "Sam Student", role: "student" },
  driver: { id: "user-driver1", email: "driver1@pacific.edu", name: "Dana Driver", role: "driver" },
  admin: { id: "user-admin", email: "admin@pacific.edu", name: "Alex Admin", role: "admin" },
};

export const serviceOpen: ServiceStatus = {
  open: true,
  mode: "automatic",
  nextChange: new Date(Date.now() + 3 * 3_600_000).toISOString(),
  maxPartySize: 5,
};
export const serviceClosed: ServiceStatus = { open: false, mode: "off", nextChange: null, maxPartySize: 5 };

export const carts: Cart[] = [
  { id: "cart-1", number: "1", seats: 6, active: true, inUseBy: "Tiger 1" },
  { id: "cart-2", number: "2", seats: 4, active: true, inUseBy: null },
];

const baseRide: Ride = {
  id: "ride-1",
  status: "requested",
  pickup: stops[0],
  dropoff: stops[4],
  partySize: 1,
  requestedAt: minutesAgo(4),
  assignedAt: null,
  arrivedAt: null,
  startedAt: null,
  endedAt: null,
  cancelReason: null,
  driver: null,
  queuePosition: 2,
  eta: null,
  rating: null,
};

/** The student's ride at each step, for building the tracking page. */
export const rides = {
  requested: baseRide,
  assigned: {
    ...baseRide,
    status: "assigned",
    assignedAt: minutesAgo(2),
    driver: { callSign: "Tiger 1", cartNumber: "1" },
    queuePosition: null,
    eta: { minMinutes: 3, maxMinutes: 6 },
  },
  arrived: {
    ...baseRide,
    status: "arrived",
    assignedAt: minutesAgo(6),
    arrivedAt: minutesAgo(0),
    driver: { callSign: "Tiger 1", cartNumber: "1" },
    queuePosition: null,
  },
  completed: {
    ...baseRide,
    status: "completed",
    assignedAt: minutesAgo(20),
    arrivedAt: minutesAgo(15),
    startedAt: minutesAgo(14),
    endedAt: minutesAgo(8),
    driver: { callSign: "Tiger 1", cartNumber: "1" },
    queuePosition: null,
    rating: 5,
  },
  canceled: { ...baseRide, status: "canceled", endedAt: minutesAgo(1), cancelReason: "Canceled by student", queuePosition: null },
} satisfies Record<string, Ride>;

const sam = { id: "user-student", name: "Sam Student" };

const waiting: StaffRide[] = [
  { ...baseRide, id: "ride-2", student: { id: "user-jo", name: "Jo Rivera" }, pickup: stops[2], dropoff: stops[1], requestedAt: minutesAgo(7), queuePosition: 1 },
  { ...baseRide, student: sam },
  { ...baseRide, id: "ride-3", student: { id: "user-lee", name: "Lee Park" }, pickup: stops[5], dropoff: stops[3], partySize: 3, requestedAt: minutesAgo(1), queuePosition: 3 },
];

const held: StaffRide = { ...rides.assigned, id: "ride-4", student: { id: "user-kim", name: "Kim Ortiz" }, pickup: stops[3], dropoff: stops[0] };

export const driverQueue: DriverQueue = {
  shift: { cart: carts[0], startedAt: minutesAgo(45) },
  mine: [held],
  waiting,
};

export const driverOffShift: DriverQueue = { shift: null, mine: [], waiting: [] };

export const adminBoard: AdminBoard = {
  service: serviceOpen,
  waiting,
  drivers: [
    {
      id: "user-driver1",
      name: "Dana Driver",
      callSign: "Tiger 1",
      cart: carts[0],
      position: { lat: 37.9805, lng: -121.3115, at: minutesAgo(0) },
      rides: [held],
    },
    {
      id: "user-driver2",
      name: "Drew Driver",
      callSign: "Tiger 2",
      cart: { ...carts[1], inUseBy: "Tiger 2" },
      position: null,
      rides: [],
    },
  ],
};

export const notifications: Notification[] = [
  { id: "note-1", type: "ride_assigned", text: "Tiger 1 is on the way in Cart 1.", rideId: "ride-1", read: false, createdAt: minutesAgo(2) },
  { id: "note-2", type: "ride_canceled", text: "Your ride was canceled.", rideId: "ride-0", read: true, createdAt: minutesAgo(60 * 24) },
];
