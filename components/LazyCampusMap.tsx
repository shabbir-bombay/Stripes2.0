"use client";

import dynamic from "next/dynamic";

/** `CampusMap`, loaded in the browser only: Leaflet can't run on the server. */
export const LazyCampusMap = dynamic(() => import("./CampusMap"), { ssr: false, loading: () => <div className="map" /> });
