"use client";

import { ButtonLink } from "@/components/Button";
import { ServiceBanner } from "@/components/ServiceBanner";
import { usePolling } from "@/components/usePolling";
import type { ServiceStatus } from "@/lib/types";

export default function StudentHome() {
  const { data: service, error } = usePolling<ServiceStatus>("/api/service-status");

  return (
    <main className="page stack">
      <h1>Ride</h1>
      <ServiceBanner service={service} error={error} />
      {service?.open && <ButtonLink href="/student/request">Request a ride</ButtonLink>}
    </main>
  );
}
