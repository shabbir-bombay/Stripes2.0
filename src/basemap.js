import L from "leaflet";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// Bundled, MapLibre cannot find its worker next to itself; Vite builds it (with its shared chunk) and gives the URL.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "@maplibre/maplibre-gl-leaflet";

// OpenFreeMap: OpenStreetMap data, free, no key. Liberty is the only style with 3D buildings.
const STYLES = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
};
const OSM_CREDIT =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const MODES = [
  ["liberty", "Liberty"],
  ["bright", "Bright"],
  ["satellite", "Satellite"],
  ["3d", "3D"],
];
const STORAGE_KEY = "stripes-basemap";
maplibregl.setWorkerUrl(workerUrl);

/**
 * Fills `segmented` with the style buttons and switches `map`'s background.
 * 3D is a tilted MapLibre view laid over the Leaflet map; it is view-only, because Leaflet
 * (where all the editing lives) cannot tilt. `overlay()` returns GeoJSON to show in 3D, with
 * an optional `color` property per feature.
 */
export function setupBasemap(map, segmented, { overlay, onError = () => {} }) {
  const layers = {
    liberty: L.maplibreGL({ style: STYLES.liberty, attribution: OSM_CREDIT }),
    bright: L.maplibreGL({ style: STYLES.bright, attribution: OSM_CREDIT }),
    satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxNativeZoom: 19,
      maxZoom: 22,
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    }),
  };
  layers.satellite.on("tileerror", () => onError(true)).on("tileload", () => onError(false));
  let current = null, view3d = null;
  const workspace = map.getContainer().closest(".map-workspace");

  segmented.innerHTML = MODES.map(([key, label]) => `<button data-basemap="${key}" aria-pressed="false">${label}</button>`).join("");
  segmented.onclick = (event) => {
    const button = event.target.closest("[data-basemap]");
    if (button) set(button.dataset.basemap);
  };

  function mark(name) {
    for (const button of segmented.querySelectorAll("[data-basemap]")) {
      button.classList.toggle("active", button.dataset.basemap === name);
      button.setAttribute("aria-pressed", String(button.dataset.basemap === name));
    }
  }

  function set(name) {
    if (name === "3d") return open3d();
    close3d();
    if (current !== name) {
      if (current) map.removeLayer(layers[current]);
      layers[name].addTo(map);
      current = name;
      onError(false);
    }
    mark(name);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* The choice just is not remembered. */
    }
  }

  function open3d() {
    if (view3d) return;
    const box = document.createElement("div");
    box.className = "map-3d";
    workspace.append(box);
    const center = map.getCenter();
    // MapLibre's zoom is one lower than Leaflet's for the same scale (512 px tiles).
    view3d = new maplibregl.Map({ container: box, style: STYLES.liberty, center: [center.lng, center.lat], zoom: map.getZoom() - 1, pitch: 60, bearing: -20, maxPitch: 85 });
    view3d.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    view3d.on("load", () => {
      view3d.addSource("overlay", { type: "geojson", data: overlay() });
      view3d.addLayer({ id: "overlay-lines", type: "line", source: "overlay", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["coalesce", ["get", "color"], "#b84e2f"], "line-width": 4 } });
      view3d.addLayer({ id: "overlay-points", type: "circle", source: "overlay", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 6, "circle-color": ["coalesce", ["get", "color"], "#b84e2f"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    });
    workspace.classList.add("is-3d");
    mark("3d");
  }

  function close3d() {
    if (!view3d) return;
    const center = view3d.getCenter();
    map.setView([center.lat, center.lng], view3d.getZoom() + 1, { animate: false });
    const box = view3d.getContainer();
    view3d.remove();
    box.remove();
    view3d = null;
    workspace.classList.remove("is-3d");
  }

  let saved = "liberty";
  try {
    saved = localStorage.getItem(STORAGE_KEY) ?? saved;
  } catch {
    /* Default style. */
  }
  set(layers[saved] ? saved : "liberty");
}
