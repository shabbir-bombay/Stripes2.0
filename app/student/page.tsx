"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { ButtonLink } from "@/components/Button";
import type { MapPin } from "@/components/CampusMap";
import { Icon } from "@/components/Icon";
import { MapScreen } from "@/components/MapScreen";
import { changeTime, serviceChip } from "@/components/serviceStatus";
import { usePolling } from "@/components/usePolling";
import type { HistoryPage, Ride, ServiceStatus, Stop } from "@/lib/types";

/** The Ride tab: "Where to?" over the campus map. A student with a ride goes straight to it. */
export default function StudentHome() {
  const router = useRouter();
  const { data: service, error } = usePolling<ServiceStatus>("/api/service-status");
  const { data: ride } = usePolling<Ride | null>("/api/rides/active");
  const [stops, setStops] = useState<Stop[]>([]);
  const [last, setLast] = useState<Ride>();

  useEffect(() => {
    if (ride) router.replace("/student/ride");
  }, [ride, router]);

  useEffect(() => {
    api<Stop[]>("/api/stops").then(setStops).catch(() => {});
    // Campus trips repeat: the newest completed ride is one tap away.
    api<HistoryPage>("/api/rides/history")
      .then((page) => setLast(page.rides.find((past) => past.status === "completed")))
      .catch(() => {});
  }, []);

  const pins: MapPin[] = stops.map((stop) => ({ id: stop.id, kind: "campus-stop", lat: stop.lat, lng: stop.lng, label: stop.name, showLabel: false }));
  const chip = serviceChip(service);

  return (
    <MapScreen
      pins={pins}
      label="Campus map with every Stripes stop"
      top={
        <p role="status" className="chip">
          <span className={`dot ${chip.dot}`} aria-hidden="true" />
          {chip.text}
        </p>
      }
    >
      {service && !service.open ? (
        <>
          <h1 className="sheet-title large">Stripes is closed</h1>
          <p className="sub">{service.nextChange ? `It opens ${changeTime(service.nextChange)}.` : "No rides can be requested right now."}</p>
        </>
      ) : (
        <>
          <h1 className="sheet-title large">Where to?</h1>
          <ButtonLink href="/student/request" variant="tonal" className="search-button">
            <Icon name="search" />
            Choose pickup and drop-off
          </ButtonLink>
          {last && (
            <>
              <h2 className="group-label tight">Ride again</h2>
              <ul className="list">
                <li>
                  <Link className="list-item center link-row" href={`/student/request?pickup=${last.pickup.id}&dropoff=${last.dropoff.id}`}>
                    <span>
                      <span className="list-item-title">{last.dropoff.name}</span>
                      <span className="list-item-meta">From {last.pickup.name}</span>
                    </span>
                    <Icon name="chevron" />
                  </Link>
                </li>
              </ul>
            </>
          )}
        </>
      )}
      {error && <p className="field-error">{error}</p>}
    </MapScreen>
  );
}
