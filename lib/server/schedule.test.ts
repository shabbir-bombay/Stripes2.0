import assert from "node:assert/strict";
import test from "node:test";
import { parseServiceRule, scheduleStatus } from "./schedule.ts";

// Days used below, in campus time (Pacific): Wed 2026-11-04 is 3 = Wednesday, PST (UTC-8) since Nov 1.
const WED = 3;
const THU = 4;
const pst = (date: string, time: string) => new Date(`${date}T${time}:00-08:00`);
const pdt = (date: string, time: string) => new Date(`${date}T${time}:00-07:00`);

test("no rules: closed, with nothing to wait for", () => {
  assert.deepEqual(scheduleStatus([], pst("2026-11-04", "22:00")), { open: false, nextChange: null });
});

test("a same-day window opens at its start and closes at its end", () => {
  const rules = [{ day: WED, start: "09:00", end: "17:00" }];
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "08:59")), { open: false, nextChange: pst("2026-11-04", "09:00") });
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "09:00")), { open: true, nextChange: pst("2026-11-04", "17:00") });
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "16:59")), { open: true, nextChange: pst("2026-11-04", "17:00") });
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "17:00")), { open: false, nextChange: pst("2026-11-11", "09:00") });
});

test("an overnight window belongs to the day it starts", () => {
  const rules = [{ day: WED, start: "21:00", end: "02:00" }];
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "20:59")).open, false);
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "23:30")), { open: true, nextChange: pst("2026-11-05", "02:00") });
  // Early Thursday is still Wednesday's window.
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-05", "01:59")), { open: true, nextChange: pst("2026-11-05", "02:00") });
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-05", "02:00")), { open: false, nextChange: pst("2026-11-11", "21:00") });
  // Early Wednesday is not: it would be Tuesday's window, and there is none.
  assert.equal(scheduleStatus(rules, pst("2026-11-04", "01:00")).open, false);
});

test("an overnight window across the end of the week", () => {
  const rules = [{ day: 6, start: "21:00", end: "02:00" }];
  assert.equal(scheduleStatus(rules, pst("2026-11-07", "22:00")).open, true);
  assert.equal(scheduleStatus(rules, pst("2026-11-08", "01:00")).open, true); // Sunday morning, Saturday's rule
  assert.equal(scheduleStatus(rules, pst("2026-11-08", "03:00")).open, false);
});

test("start = end means a full day", () => {
  const rules = [{ day: WED, start: "06:00", end: "06:00" }];
  assert.equal(scheduleStatus(rules, pst("2026-11-04", "05:59")).open, false);
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "06:00")), { open: true, nextChange: pst("2026-11-05", "06:00") });
  assert.equal(scheduleStatus(rules, pst("2026-11-05", "05:59")).open, true);
  assert.equal(scheduleStatus(rules, pst("2026-11-05", "06:00")).open, false);
});

test("overlapping and touching rules combine into one opening", () => {
  const rules = [
    { day: WED, start: "09:00", end: "12:00" },
    { day: WED, start: "11:00", end: "14:00" },
    { day: WED, start: "14:00", end: "16:00" },
  ];
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "10:00")), { open: true, nextChange: pst("2026-11-04", "16:00") });
});

test("an overnight window runs into the next day's rule", () => {
  const rules = [
    { day: WED, start: "21:00", end: "02:00" },
    { day: THU, start: "01:00", end: "03:00" },
  ];
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "22:00")), { open: true, nextChange: pst("2026-11-05", "03:00") });
});

test("a rule inside a longer one doesn't cut it short", () => {
  const rules = [
    { day: WED, start: "09:00", end: "17:00" },
    { day: WED, start: "10:00", end: "11:00" },
  ];
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "10:30")), { open: true, nextChange: pst("2026-11-04", "17:00") });
});

test("the next opening is the soonest of several, later the same week", () => {
  const rules = [
    { day: 5, start: "20:00", end: "23:00" },
    { day: THU, start: "20:00", end: "23:00" },
  ];
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "12:00")), { open: false, nextChange: pst("2026-11-05", "20:00") });
});

test("open all week has no next change", () => {
  const rules = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "00:00", end: "00:00" }));
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "12:00")), { open: true, nextChange: null });
});

test("open all week but for one gap still finds the gap", () => {
  const rules = [0, 1, 2, 4, 5, 6].map((day) => ({ day, start: "00:00", end: "00:00" }));
  rules.push({ day: WED, start: "00:01", end: "00:00" });
  // The gap is 00:00-00:01 next Wednesday, 7 days away less a little.
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-04", "12:00")), { open: true, nextChange: pst("2026-11-11", "00:00") });
});

test("the Pacific time rule holds whatever the server's time zone: an instant is judged in campus time", () => {
  const rules = [{ day: WED, start: "21:00", end: "23:00" }];
  // 22:00 Wednesday on campus is already Thursday in UTC.
  assert.equal(scheduleStatus(rules, new Date("2026-11-05T06:00:00Z")).open, true);
});

// Clocks go back at 2:00 AM on Sunday 2026-11-01: 1:00–2:00 AM happens twice.
test("clocks going back: a night window that spans the change lasts an hour longer", () => {
  const rules = [{ day: 6, start: "22:00", end: "03:00" }]; // Saturday Oct 31
  const opened = pdt("2026-10-31", "22:00");
  const { open, nextChange } = scheduleStatus(rules, opened);
  assert.equal(open, true);
  assert.deepEqual(nextChange, pst("2026-11-01", "03:00"));
  assert.equal((nextChange!.getTime() - opened.getTime()) / 3_600_000, 6);
});

test("clocks going back: a time that happens twice means the first one", () => {
  const rules = [{ day: 0, start: "01:30", end: "05:00" }]; // Sunday Nov 1
  assert.equal(scheduleStatus(rules, pdt("2026-11-01", "01:29")).open, false);
  assert.equal(scheduleStatus(rules, pdt("2026-11-01", "01:30")).open, true);
  assert.equal(scheduleStatus(rules, pst("2026-11-01", "01:15")).open, true); // the second 1:15, after the first 1:30
});

test("clocks going back: the windows either side keep their campus times", () => {
  const rules = [{ day: 0, start: "09:00", end: "17:00" }];
  assert.deepEqual(scheduleStatus(rules, pdt("2026-10-31", "12:00")), { open: false, nextChange: pst("2026-11-01", "09:00") });
  assert.deepEqual(scheduleStatus(rules, pst("2026-11-01", "12:00")), { open: true, nextChange: pst("2026-11-01", "17:00") });
});

// Clocks go forward at 2:00 AM on Sunday 2026-03-08: 2:00–3:00 AM doesn't happen.
test("clocks going forward: a night window that spans the change lasts an hour less", () => {
  const rules = [{ day: 6, start: "22:00", end: "03:00" }]; // Saturday Mar 7
  const opened = pst("2026-03-07", "22:00");
  const { nextChange } = scheduleStatus(rules, opened);
  assert.deepEqual(nextChange, pdt("2026-03-08", "03:00"));
  assert.equal((nextChange!.getTime() - opened.getTime()) / 3_600_000, 4);
});

test("clocks going forward: a time that never happens moves past the change", () => {
  const rules = [{ day: 0, start: "02:30", end: "05:00" }]; // Sunday Mar 8
  assert.equal(scheduleStatus(rules, pdt("2026-03-08", "03:29")).open, false);
  assert.equal(scheduleStatus(rules, pdt("2026-03-08", "03:30")).open, true);
  assert.equal(scheduleStatus(rules, pdt("2026-03-08", "04:59")).open, true);
  assert.equal(scheduleStatus(rules, pdt("2026-03-08", "05:00")).open, false);
});

test("the day after a clock change keeps its campus times", () => {
  const rules = [{ day: 1, start: "09:00", end: "17:00" }]; // Monday
  assert.equal(scheduleStatus(rules, pdt("2026-03-09", "09:00")).open, true);
  assert.equal(scheduleStatus(rules, pdt("2026-03-09", "08:59")).open, false);
  assert.equal(scheduleStatus(rules, pst("2026-11-02", "09:00")).open, true);
  assert.equal(scheduleStatus(rules, pst("2026-11-02", "08:59")).open, false);
});

test("a good rule is accepted and keeps only its three fields", () => {
  assert.deepEqual(parseServiceRule({ day: 0, start: "00:00", end: "23:59", extra: true }), {
    ok: true,
    rule: { day: 0, start: "00:00", end: "23:59" },
  });
  assert.equal(parseServiceRule({ day: 6, start: "21:00", end: "02:00" }).ok, true);
  assert.equal(parseServiceRule({ day: 3, start: "06:00", end: "06:00" }).ok, true);
});

test("a bad rule is refused", () => {
  assert.equal(parseServiceRule(null).ok, false);
  for (const day of [-1, 7, 1.5, "3", null, undefined]) {
    assert.equal(parseServiceRule({ day, start: "09:00", end: "17:00" }).ok, false, String(day));
  }
  for (const time of ["24:00", "9:00", "09:60", "09:00:00", "", "nine", 900, null, undefined]) {
    assert.equal(parseServiceRule({ day: 1, start: time, end: "17:00" }).ok, false, `start ${time}`);
    assert.equal(parseServiceRule({ day: 1, start: "09:00", end: time }).ok, false, `end ${time}`);
  }
});
