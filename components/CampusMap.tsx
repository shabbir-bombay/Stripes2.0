"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapPin {
  /** Stays the same while the pin moves, so its marker moves instead of being redrawn. */
  id: string;
  kind: "stop" | "cart";
  lat: number;
  lng: number;
  /** Shown next to the pin, so the pins differ by more than color. */
  label: string;
}

const CAMPUS: L.LatLngTuple = [37.98, -121.3115];

/**
 * A map of campus with pins on it. Leaflet needs a browser, so load this with `next/dynamic` and `ssr: false`.
 * The view frames the pins again whenever one appears or leaves, or moves out of sight, until the user drags the map.
 */
export default function CampusMap({ pins, label }: { pins: MapPin[]; label: string }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const framed = useRef<string | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const created = L.map(element.current!).setView(CAMPUS, 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(created);
    created.on("dragstart", () => {
      dragged.current = true;
    });
    map.current = created;
    const placed = markers.current;
    return () => {
      created.remove();
      map.current = null;
      placed.clear();
      framed.current = null;
    };
  }, []);

  useEffect(() => {
    const leaflet = map.current;
    if (!leaflet) return;

    for (const [id, marker] of markers.current) {
      if (!pins.some((pin) => pin.id === id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
    for (const pin of pins) {
      const marker = markers.current.get(pin.id);
      if (marker) {
        marker.setLatLng([pin.lat, pin.lng]);
        marker.setTooltipContent(pin.label);
      } else {
        const icon = L.divIcon({ className: `map-pin ${pin.kind}`, iconSize: [20, 20] });
        const created = L.marker([pin.lat, pin.lng], { icon, keyboard: false, alt: pin.label })
          .bindTooltip(pin.label, { permanent: true, direction: "top", offset: [0, -10] })
          .addTo(leaflet);
        markers.current.set(pin.id, created);
      }
    }

    const ids = pins.map((pin) => pin.id).join();
    const hidden = pins.some((pin) => !leaflet.getBounds().contains([pin.lat, pin.lng]));
    if (pins.length > 0 && (ids !== framed.current || (hidden && !dragged.current))) {
      if (ids !== framed.current) dragged.current = false;
      framed.current = ids;
      const bounds = L.latLngBounds(pins.map((pin): L.LatLngTuple => [pin.lat, pin.lng]));
      leaflet.fitBounds(bounds, { padding: [56, 56], maxZoom: 17 });
    }
  }, [pins]);

  return <div ref={element} className="map" role="region" aria-label={label} />;
}
