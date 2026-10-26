import type { ServiceStatus } from "@/lib/types";

/** Whether Stripes is running, and when that changes. */
export function ServiceBanner({ service, error }: { service?: ServiceStatus; error?: string }) {
  if (!service) {
    return (
      <p role="status" className="banner">
        {error ?? "Checking whether Stripes is running…"}
      </p>
    );
  }
  const change = service.nextChange && campusTime(service.nextChange);
  return (
    <div role="status" className={`banner ${service.open ? "open" : "closed"}`}>
      <p className="banner-title">{service.open ? "Stripes is running" : "Stripes is closed"}</p>
      <p>
        {service.open
          ? change ? `Request a ride until ${change}.` : "Request a ride and a cart will pick you up."
          : change ? `It opens ${change}.` : "No rides can be requested right now."}
      </p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** "Tue 9:00 PM" in campus time, whatever the phone's time zone. */
function campusTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}
