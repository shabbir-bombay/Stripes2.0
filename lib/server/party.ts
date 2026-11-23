// How many riders one request may hold. Pure, so it can be tested without a database.

/** The most riders one request can hold, the student included, whatever the carts' size. */
export const MAX_PARTY_SIZE = 3;

/** The largest party a request may have: 3, or fewer when the biggest active cart (seats include the driver's) is smaller. */
export function partyLimit(largestSeats: number | null) {
  if (!largestSeats) return 1;
  return Math.max(1, Math.min(MAX_PARTY_SIZE, largestSeats - 1));
}
