import type { ServiceRuleInput } from "../types";

// The weekly service hours, as pure functions. Rules are in campus time; everything else here is an instant.

const CAMPUS_TIME_ZONE = "America/Los_Angeles";
const DAY_MS = 24 * 3_600_000;
/** The furthest ahead a change can be: a week, plus the hour a clock change can add. Anything past this is never. */
const LOOK_AHEAD_DAYS = 8;

const TIME = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

const campusParts = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** The campus wall clock at an instant, written as if it were UTC. Handy for date maths and offsets. */
function campusWallClock(instant: number) {
  const parts = Object.fromEntries(campusParts.formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

/** How far the campus wall clock is from UTC at an instant given in whole seconds. */
const campusOffset = (instant: number) => campusWallClock(instant) - instant;

/**
 * The instant a campus wall clock shows this time (given as if it were UTC).
 * When the clocks go back and a time happens twice, this is the first. When they go forward and it never
 * happens, this is that much past the change: 2:30 AM becomes 3:30 AM.
 */
function campusInstant(wallClock: number) {
  const first = wallClock - campusOffset(wallClock);
  const offset = campusOffset(first);
  const second = wallClock - offset;
  if (first === second) return first;
  return campusOffset(second) === offset ? second : Math.max(first, second);
}

function minutes(time: string) {
  const match = TIME.exec(time);
  if (!match) throw new Error(`Bad time: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Every window the rules open from yesterday (an overnight window may still be running) to past the look-ahead, merged. */
function openWindows(rules: ServiceRuleInput[], now: number) {
  const today = Math.floor(campusWallClock(now) / DAY_MS) * DAY_MS;
  const windows: { start: number; end: number }[] = [];
  for (let i = -1; i <= LOOK_AHEAD_DAYS; i++) {
    const date = today + i * DAY_MS;
    const weekday = new Date(date).getUTCDay();
    for (const rule of rules) {
      if (rule.day !== weekday) continue;
      const start = minutes(rule.start);
      const end = minutes(rule.end);
      // An end at or before the start is on the next day, so start = end is a full day.
      const endDate = end <= start ? date + DAY_MS : date;
      windows.push({ start: campusInstant(date + start * 60_000), end: campusInstant(endDate + end * 60_000) });
    }
  }
  windows.sort((a, b) => a.start - b.start);

  const merged: typeof windows = [];
  for (const window of windows) {
    const last = merged.at(-1);
    if (last && window.start <= last.end) last.end = Math.max(last.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}

/** Whether the rules have the service open at `at`, and when that next changes. Null means it never does. */
export function scheduleStatus(rules: ServiceRuleInput[], at = new Date()): { open: boolean; nextChange: Date | null } {
  const now = at.getTime();
  const windows = openWindows(rules, now);
  const current = windows.find((window) => window.start <= now && now < window.end);
  if (current) {
    // Open past the look-ahead means open all week, every week.
    const never = current.end >= now + LOOK_AHEAD_DAYS * DAY_MS;
    return { open: true, nextChange: never ? null : new Date(current.end) };
  }
  const next = windows.find((window) => window.start > now);
  return { open: false, nextChange: next ? new Date(next.start) : null };
}

export type ParsedRule = { ok: true; rule: ServiceRuleInput } | { ok: false; error: string };

/** Checks a `ServiceRuleInput` body. */
export function parseServiceRule(body: Record<string, unknown> | null): ParsedRule {
  const { day, start, end } = body ?? {};
  if (!Number.isInteger(day) || (day as number) < 0 || (day as number) > 6) return { ok: false, error: "Day must be from 0 (Sunday) to 6 (Saturday)." };
  if (typeof start !== "string" || !TIME.test(start)) return { ok: false, error: "Start must be a time like 21:00." };
  if (typeof end !== "string" || !TIME.test(end)) return { ok: false, error: "End must be a time like 02:00." };
  return { ok: true, rule: { day: day as number, start, end } };
}
