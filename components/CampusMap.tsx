"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapPin {
  /** Stays the same while the pin moves, so its marker moves instead of being redrawn. */
  id: string;
  /** `stale` is a cart whose position is out of date. */
  kind: "stop" | "cart" | "stale";
  lat: number;
  lng: number;
  /** Shown next to the pin, so the pins differ by more than color. */
  label: string;
}

const CAMPUS: L.LatLngTuple = [37.98, -121.3115];

const pinIcon = (kind: MapPin["kind"]) => L.divIcon({ className: `map-pin ${kind}`, iconSize: [20, 20] });

/**
 * A map of campus with pins on it. Leaflet needs a browser, so use it through `LazyCampusMap`.
 * The view frames the pins whenever one appears or leaves. It also follows a pin moving out of sight,
 * until the user drags or zooms the map themselves.
 */
export default function CampusMap({ pins, label }: { pins: MapPin[]; label: string }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const framed = useRef<string | null>(null);
  const movedByUser = useRef(false);
  const framing = useRef(false);

  useEffect(() => {
    const created = L.map(element.current!).setView(CAMPUS, 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(created);
    created.on("dragstart zoomstart", () => {
      if (!framing.current) movedByUser.current = true;
    });
    created.on("moveend", () => {
      framing.current = false;
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
        if (marker.getTooltip()?.getContent() !== pin.label) marker.setTooltipContent(pin.label);
        if (marker.options.icon?.options.className !== `map-pin ${pin.kind}`) marker.setIcon(pinIcon(pin.kind));
      } else {
        const created = L.marker([pin.lat, pin.lng], { icon: pinIcon(pin.kind), keyboard: false, alt: pin.label })
          .bindTooltip(pin.label, { permanent: true, direction: "top", offset: [0, -10] })
          .addTo(leaflet);
        markers.current.set(pin.id, created);
      }
    }

    const ids = pins.map((pin) => pin.id).join();
    const hidden = pins.some((pin) => !leaflet.getBounds().contains([pin.lat, pin.lng]));
    if (pins.length > 0 && (ids !== framed.current || (hidden && !movedByUser.current))) {
      if (ids !== framed.current) movedByUser.current = false;
      framed.current = ids;
      framing.current = true;
      const bounds = L.latLngBounds(pins.map((pin): L.LatLngTuple => [pin.lat, pin.lng]));
      leaflet.fitBounds(bounds, { padding: [56, 56], maxZoom: 17 });
    }
  }, [pins]);

  return <div ref={element} className="map" role="region" aria-label={label} />;
}
