// Local and demo data. Safe to run again: everything is matched by email, number or name.
// Every seeded account's password is SEED_PASSWORD, or "stripes-dev" when it isn't set.
import { db } from "../lib/server/db";
import type { Role } from "../lib/server/generated/prisma/client";
import { hashPassword } from "../lib/server/password";

const passwordHash = await hashPassword(process.env.SEED_PASSWORD ?? "stripes-dev");

const users: { email: string; name: string; role: Role; callSign?: string }[] = [
  { email: "admin@pacific.edu", name: "Alex Admin", role: "admin" },
  { email: "driver1@pacific.edu", name: "Dana Driver", role: "driver", callSign: "Tiger 1" },
  { email: "driver2@pacific.edu", name: "Drew Driver", role: "driver", callSign: "Tiger 2" },
  { email: "student@u.pacific.edu", name: "Sam Student", role: "student" },
];

const carts = [
  { number: "1", seats: 6 },
  { number: "2", seats: 4 },
];

// One accessible door per building, from the Campus-Studio gate list (data/gates.csv).
const stops = [
  { name: "Burns Tower", lat: 37.98081969, lng: -121.3085353 },
  { name: "DeRosa University Center", lat: 37.98170764, lng: -121.3118559 },
  { name: "William Knox Holt Memorial Library", lat: 37.97957444, lng: -121.3092595 },
  { name: "Baun Student Fitness Center", lat: 37.98057657, lng: -121.312961 },
  { name: "Grace Covell Hall", lat: 37.98165584, lng: -121.3099019 },
  { name: "Elbert Covell Hall", lat: 37.97889895, lng: -121.3132252 },
  { name: "Monagan Hall", lat: 37.98355537, lng: -121.3141948 },
  { name: "Chan Family Hall", lat: 37.98385557, lng: -121.3130522 },
  { name: "Cowell Wellness Center", lat: 37.98337567, lng: -121.3150585 },
  { name: "Department of Public Safety", lat: 37.98337144, lng: -121.3154769 },
  { name: "Eberhardt School of Business", lat: 37.9809402, lng: -121.3091388 },
  { name: "John Chambers Technology Center", lat: 37.97888627, lng: -121.3110995 },
  { name: "Khoury Hall", lat: 37.97979, lng: -121.31102 },
  { name: "Classroom Building", lat: 37.97626988, lng: -121.3110191 },
  { name: "Biological Laboratories", lat: 37.97637771, lng: -121.3117111 },
  { name: "Faye Spanos Concert Hall", lat: 37.98003428, lng: -121.3078594 },
  { name: "Main Gymnasium", lat: 37.97990849, lng: -121.3121188 },
  { name: "Thomas J. Long School of Pharmacy", lat: 37.98461452, lng: -121.3117728 },
  { name: "Jeannette Powell Art Center", lat: 37.97537552, lng: -121.3128805 },
  { name: "TownHouse B", lat: 37.98120447, lng: -121.3179928 },
];

for (const { callSign, ...user } of users) {
  const { id } = await db.user.upsert({
    where: { email: user.email },
    update: { ...user, passwordHash },
    create: { ...user, passwordHash },
  });
  if (callSign) await db.driverProfile.upsert({ where: { userId: id }, update: { callSign }, create: { userId: id, callSign } });
}
for (const cart of carts) await db.cart.upsert({ where: { number: cart.number }, update: cart, create: cart });
for (const stop of stops) await db.stop.upsert({ where: { name: stop.name }, update: stop, create: stop });

console.log(`Seeded ${users.length} users, ${carts.length} carts, ${stops.length} stops.`);
await db.$disconnect();
