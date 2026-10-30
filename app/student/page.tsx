"use client";

import { ButtonLink } from "@/components/Button";
import { ServiceBanner } from "@/components/ServiceBanner";
import { usePolling } from "@/components/usePolling";
import type { Ride, ServiceStatus } from "@/lib/types";

export default function StudentHome() {
  const { data: service, error } = usePolling<ServiceStatus>("/api/service-status");
  const { data: ride } = usePolling<Ride | null>("/api/rides/active");

  return (
    <main className="page stack">
      <h1>Ride</h1>
      <ServiceBanner service={service} error={error} />
      {ride ? (
        <ButtonLink href="/student/ride">Track your ride</ButtonLink>
      ) : (
        service?.open && ride === null && <ButtonLink href="/student/request">Request a ride</ButtonLink>
      )}
    </main>
  );
}
