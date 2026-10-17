// Accounts are for Pacific staff (@pacific.edu) and students (@u.pacific.edu) only.
// The database has the same rule as a CHECK; this one gives a readable error first.

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isPacificEmail(email: string) {
  return /^[^\s@]+@(u\.)?pacific\.edu$/.test(normalizeEmail(email));
}
