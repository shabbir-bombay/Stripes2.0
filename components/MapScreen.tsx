import type { ReactNode } from "react";
import type { MapPin } from "./CampusMap";
import { LazyCampusMap } from "./LazyCampusMap";

/**
 * The ride-app layout for students and drivers: campus map filling the screen, chips over its top edge,
 * and a sheet over its bottom edge holding the one decision on screen.
 */
export function MapScreen({ pins, label, top, children }: { pins: MapPin[]; label: string; top?: ReactNode; children: ReactNode }) {
  return (
    <main className="map-screen">
      {top && <div className="map-top">{top}</div>}
      <LazyCampusMap pins={pins} label={label} zoomControl={false} />
      <section className="sheet">{children}</section>
    </main>
  );
}
