import type { ServiceStatus } from "@/lib/types";

/** Whether Stripes is running, for the chip over the map: "Running until 1:30 AM", "Closed · opens Tue 9:00 PM". */
export function serviceChip(service?: ServiceStatus) {
  if (!service) return { text: "Checking service…", dot: "off" };
  const change = service.nextChange && changeTime(service.nextChange);
  if (service.open) return { text: change ? `Running until ${change}` : "Running", dot: "" };
  return { text: change ? `Closed · opens ${change}` : "Closed", dot: "off" };
}

/** "1:30 AM" when the change is within the next 18 hours, otherwise "Tue 9:00 PM", in campus time. */
export function changeTime(iso: string, now = Date.now()) {
  const soon = Date.parse(iso) - now < 18 * 3600_000;
  return new Date(iso).toLocaleString("en-US", {
    weekday: soon ? undefined : "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}
