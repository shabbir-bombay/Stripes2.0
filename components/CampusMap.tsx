"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapPin {
  /** Stays the same while the pin moves, so its marker moves instead of being redrawn. */
  id: string;
  /**
   * Admin pins: `stop`, `cart`, and `stale` (a cart whose position is out of date).
   * Student and driver pins: `pickup` (dot), `dropoff` (square), `vehicle` (the cart) and `campus-stop` (small grey dot).
   */
  kind: "stop" | "cart" | "stale" | "pickup" | "dropoff" | "vehicle" | "campus-stop";
  lat: number;
  lng: number;
  /** Shown next to the pin, so the pins differ by more than color. */
  label: string;
  /** False keeps the label off the map, for pins the map's own label already covers (the cart, "You", campus stops). */
  showLabel?: boolean;
}

const CAMPUS: L.LatLngTuple = [37.98, -121.3115];

const ADMIN_KINDS: MapPin["kind"][] = ["stop", "cart", "stale"];

const pinClass = (kind: MapPin["kind"]) => (ADMIN_KINDS.includes(kind) ? `map-pin ${kind}` : `pin ${kind}`);

function pinIcon(kind: MapPin["kind"]) {
  if (ADMIN_KINDS.includes(kind)) return L.divIcon({ className: pinClass(kind), iconSize: [20, 20] });
  const size = kind === "campus-stop" ? 14 : 36;
  return L.divIcon({ className: pinClass(kind), html: "<span></span>", iconSize: [size, size] });
}

/**
 * A map of campus with pins on it. Leaflet needs a browser, so use it through `LazyCampusMap`.
 * The view frames the pins whenever one appears or leaves. It also follows a pin moving out of sight,
 * until the user drags or zooms the map themselves.
 */
export default function CampusMap({ pins, label, zoomControl = true, className = "map" }: {
  pins: MapPin[];
  label: string;
  /** Off on the student and driver screens, where chips sit over the map; pinch and double-tap still zoom. */
  zoomControl?: boolean;
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const framed = useRef<string | null>(null);
  const movedByUser = useRef(false);
  const framing = useRef(false);
  const bounds = useRef<L.LatLngBounds | null>(null);

  useEffect(() => {
    const created = L.map(element.current!, { zoomControl }).setView(CAMPUS, 16);
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
    let zooming = false;
    created.on("zoomstart", () => {
      zooming = true;
    });
    created.on("zoomend", () => {
      zooming = false;
    });
    map.current = created;
    const placed = markers.current;
    // The sheet over a map grows and shrinks with its content, so the map follows its box and keeps the pins framed.
    const resized = new ResizeObserver(() => {
      created.invalidateSize({ pan: false });
      if (bounds.current && !movedByUser.current) {
        framing.current = true;
        created.fitBounds(bounds.current, { padding: [56, 56], maxZoom: 17, animate: false });
      }
    });
    resized.observe(element.current!);
    return () => {
      resized.disconnect();
      map.current = null;
      placed.clear();
      framed.current = null;
      // Leaflet ends a zoom animation on a timer that remove() doesn't cancel, and that timer throws once the map is
      // gone. So a map closed mid-zoom (the ride ends, the driver leaves the page) is removed once the zoom is over.
      let removed = false;
      const remove = () => {
        if (removed) return;
        removed = true;
        created.remove();
      };
      if (zooming) {
        created.once("zoomend", remove);
        setTimeout(remove, 1000);
      } else {
        remove();
      }
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
        if (marker.options.icon?.options.className !== pinClass(pin.kind)) marker.setIcon(pinIcon(pin.kind));
      } else {
        const created = L.marker([pin.lat, pin.lng], { icon: pinIcon(pin.kind), keyboard: false, alt: pin.label });
        if (pin.showLabel !== false) {
          const admin = ADMIN_KINDS.includes(pin.kind);
          created.bindTooltip(pin.label, {
            permanent: true,
            direction: "top",
            offset: [0, admin ? -10 : -14],
            className: admin ? undefined : "pin-label",
          });
        }
        created.addTo(leaflet);
        markers.current.set(pin.id, created);
      }
    }

    // Small campus stops are background: framing follows the pins that matter.
    const framedPins = pins.some((pin) => pin.kind !== "campus-stop") ? pins.filter((pin) => pin.kind !== "campus-stop") : pins;
    const ids = framedPins.map((pin) => pin.id).join();
    const hidden = framedPins.some((pin) => !leaflet.getBounds().contains([pin.lat, pin.lng]));
    if (framedPins.length > 0 && (ids !== framed.current || (hidden && !movedByUser.current))) {
      if (ids !== framed.current) movedByUser.current = false;
      framed.current = ids;
      framing.current = true;
      bounds.current = L.latLngBounds(framedPins.map((pin): L.LatLngTuple => [pin.lat, pin.lng]));
      leaflet.fitBounds(bounds.current, { padding: [56, 56], maxZoom: 17 });
    } else if (framedPins.length > 0) {
      bounds.current = L.latLngBounds(framedPins.map((pin): L.LatLngTuple => [pin.lat, pin.lng]));
    }
  }, [pins]);

  return <div ref={element} className={className} role="region" aria-label={label} />;
}
