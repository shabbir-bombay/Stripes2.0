import L from "leaflet";
import { icon } from "./icons.js";
import { setupBasemap } from "./basemap.js";
import { setupCampusImage } from "./campus-image.js";
import {
  CAMPUS_BBOX,
  MAX_SNAPSHOT_BYTES,
  OVERPASS_URLS,
  addWay,
  checkSnapshot,
  deleteWay,
  formatTags,
  moveNode,
  overpassQuery,
  parseTags,
  insertVertex,
  removeVertex,
  setTags,
  toText,
  wayName,
  ways,
} from "./paths.js";

const STORAGE_KEY = "stripes-path-studio-v1";
const DEFAULT_FILE = "routes.json";
const SNAP_PIXELS = 12;
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isFoot = (way) => ["footway", "path", "pedestrian", "steps", "cycleway", "corridor"].includes(way.tags?.highway);

let started = false, map, toast;
let doc = { elements: [] }, undo = [], redo = [];
// connection: the last uploaded or downloaded copy ({ name, text }), so unsaved edits can be flagged.
let connection = null, busy = false;
let selectedId = null, search = "", filter = "all", drawing = null, picking = null;
const lines = new Map();
let handles = L.layerGroup(), draft = L.polyline([], { color: "#b84e2f", weight: 4, dashArray: "6 6" });

export function showPathStudio(showToast) {
  toast = showToast;
  if (!started) start();
  map.invalidateSize();
}

function start() {
  started = true;
  $("#path-actions").innerHTML = `<button id="path-repo">Load repo data</button><button id="path-upload">${icon("upload")} Upload file</button><button id="path-download" disabled>${icon("download")} Download file</button><input id="path-file" type="file" accept=".json,application/json" hidden /><button id="path-osm">${icon("globe")} Download from OSM</button>`;
  $("#path-workspace").innerHTML = `
    <aside class="sidebar" aria-label="Path list">
      <div class="sidebar-top"><div class="eyebrow">CAMPUS MAP</div><div class="title-row"><h1>Nodes & paths</h1><span id="path-count" class="count">0</span></div><p class="muted">Walkways and roads from OpenStreetMap.</p>
        <button id="path-file-card" class="file-card" title="Upload a map file">${icon("file")}<span><strong id="path-filename">No map yet</strong><small id="path-file-detail">JSON from OSM or a file</small></span>${icon("upload")}</button>
        <p id="path-status" class="muted" role="status"></p>
        <label class="search-box">${icon("search")}<input id="path-search" type="search" placeholder="Search path name, type or id…" aria-label="Search paths"/></label>
        <div class="filter-row"><label class="sr-only" for="path-filter">Filter paths</label><select id="path-filter"><option value="all">All paths</option><option value="foot">Walkways</option><option value="road">Roads</option><option value="new">New paths</option></select><span id="path-shown"></span></div>
      </div>
      <div id="path-list" class="point-list"></div>
      <div class="sidebar-bottom"><span class="save-indicator">Your draft stays in this browser</span><small>Use Download file to keep your changes.</small></div>
    </aside>
    <section class="map-workspace" aria-label="Interactive path map">
      <div id="path-map" aria-label="Map of campus paths"></div>
      <div class="map-toolbar"><div class="segmented" id="path-basemap" aria-label="Map style"></div><div class="map-actions"><div class="history-buttons"><button id="path-undo" title="Undo (⌘/Ctrl Z)" aria-label="Undo">${icon("undo")}</button><button id="path-redo" title="Redo (⌘/Ctrl Shift Z)" aria-label="Redo">${icon("redo")}</button></div><button id="path-image-button" title="Lay a campus map over this one">${icon("file")}<span>Campus image</span></button><button id="path-fit" title="Fit all paths">${icon("fit")}<span>Fit paths</span></button><button id="path-add" class="dark">${icon("plus")} Add path</button></div></div>
      <div id="path-stats" class="map-stats"></div>
      <section id="path-image" class="image-panel" aria-label="Campus image" hidden></section>
      <div id="path-banner" class="mode-banner" hidden></div>
      <section id="path-editor" class="editor" aria-label="Path details" hidden></section>
      <div class="map-legend"><span><i class="dot new"></i> Walkway</span><span><i class="dot original"></i> Road</span><span><i class="dot edited"></i> Selected</span></div>
      <div class="map-hint">${icon("move")}<span>Select a path, then drag its points. Click + to add a point. Shift-click a point to remove it.</span></div>
    </section>`;

  map = L.map("path-map", { zoomControl: false, maxZoom: 22, preferCanvas: true }).setView([37.9795, -121.311], 16);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
  setupBasemap(map, $("#path-basemap"), {
    overlay: () => ({
      type: "FeatureCollection",
      features: ways(doc).map((way) => ({ type: "Feature", properties: { color: way.id === selectedId ? "#b84e2f" : isFoot(way) ? "#468469" : "#558394" }, geometry: { type: "LineString", coordinates: way.geometry.map((p) => [p.lon, p.lat]) } })),
    }),
  });
  setupCampusImage(map, { panel: $("#path-image"), button: $("#path-image-button"), toast: (message) => toast(message) });
  handles.addTo(map);
  draft.addTo(map);
  new ResizeObserver(() => map.invalidateSize()).observe($("#path-map"));

  $("#path-osm").onclick = () => (picking ? stopPicking() : startPicking());
  $("#path-upload").onclick = $("#path-file-card").onclick = () => $("#path-file").click();
  $("#path-file").onchange = (event) => upload(event.target);
  $("#path-download").onclick = download;
  $("#path-undo").onclick = () => step(false);
  $("#path-redo").onclick = () => step(true);
  $("#path-fit").onclick = fit;
  $("#path-add").onclick = () => (drawing ? stopDrawing() : startDrawing());
  $("#path-search").oninput = (event) => { search = event.target.value.toLowerCase(); renderList(); };
  $("#path-filter").onchange = (event) => { filter = event.target.value; renderList(); };
  $("#path-list").onclick = (event) => {
    if (event.target.closest("#path-empty-osm")) return startPicking();
    const row = event.target.closest("[data-way]");
    if (row) select(Number(row.dataset.way), true);
  };
  $("#path-banner").onclick = (event) => {
    if (event.target.closest("#path-finish")) finishDrawing();
    if (event.target.closest("#path-cancel")) stopDrawing();
    if (event.target.closest("#path-campus")) {
      stopPicking();
      downloadOsm(CAMPUS_BBOX);
    }
    if (event.target.closest("#path-cancel-area")) stopPicking();
  };
  $("#path-editor").onclick = (event) => {
    const id = event.target.closest("button")?.id;
    if (id === "path-close") select(null);
    if (id === "path-delete" && confirm("Remove this path? Undo is available.")) {
      commit(deleteWay(doc, selectedId));
      selectedId = null;
      render();
    }
  };
  $("#path-editor").onsubmit = (event) => {
    event.preventDefault();
    try {
      commit(setTags(doc, selectedId, parseTags(new FormData(event.target).get("tags"))));
      toast("Tags saved.");
    } catch (error) {
      $("#path-form-error").textContent = error.message;
    }
  };
  map.on("click", ({ latlng }) => {
    if (!drawing) return;
    const snapped = nearestNode(latlng);
    drawing.push(snapped ?? { lat: latlng.lat, lon: latlng.lng });
    draft.setLatLngs(drawing.map((p) => [p.lat, p.lon]));
    renderBanner();
  });
  // Area picking: press, drag, release. Map panning is off while picking.
  map.on("mousedown", ({ latlng }) => {
    if (!picking) return;
    picking.start = latlng;
    picking.box.setBounds(L.latLngBounds(latlng, latlng)).addTo(map);
  });
  map.on("mousemove", ({ latlng }) => {
    if (picking?.start) picking.box.setBounds(L.latLngBounds(picking.start, latlng));
  });
  map.on("mouseup", () => {
    if (!picking?.start) return;
    const bounds = picking.box.getBounds();
    const size = map.latLngToContainerPoint(bounds.getNorthEast()).subtract(map.latLngToContainerPoint(bounds.getSouthWest()));
    stopPicking();
    if (Math.abs(size.x) < 10 || Math.abs(size.y) < 10) return toast("Drag across the map to draw the area.");
    downloadOsm({ south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() });
  });
  map.on("zoomend", renderHandles);
  map.on("dblclick", (event) => {
    if (!drawing) return;
    L.DomEvent.stop(event);
    finishDrawing();
  });
  document.addEventListener("keydown", (event) => {
    if (document.body.dataset.studio !== "paths" || document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") {
      stopDrawing();
      stopPicking();
    }
    if (event.key === "Enter" && drawing) finishDrawing();
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      step(event.shiftKey);
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty()) event.preventDefault();
  });

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved?.doc) {
      doc = checkSnapshot(JSON.stringify(saved.doc));
      connection = saved.connection ?? null;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  $("#path-repo").onclick = () => loadRepo();
  render();
  fit();
  if (!ways(doc).length) loadRepo(false);
}

const dirty = () => ways(doc).length > 0 && toText(doc) !== connection?.text;

function saveDraft() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ doc, connection }));
  } catch {
    toast("Draft storage is full. Download the file to keep your changes.");
  }
}

function commit(next) {
  undo.push(doc);
  if (undo.length > 80) undo.shift();
  redo = [];
  doc = next;
  saveDraft();
  render();
}

function step(forward) {
  const [from, to] = forward ? [redo, undo] : [undo, redo];
  if (!from.length) return;
  to.push(doc);
  doc = from.pop();
  if (!ways(doc).some((way) => way.id === selectedId)) selectedId = null;
  saveDraft();
  render();
}

function replaceDoc(next, nextConnection) {
  doc = next;
  connection = nextConnection;
  undo = [];
  redo = [];
  selectedId = null;
  saveDraft();
  render();
  fit();
}

// ---- rendering -------------------------------------------------------------------------------

function render() {
  const all = ways(doc);
  const uses = new Map();
  for (const way of all) for (const id of new Set(way.nodes)) uses.set(id, (uses.get(id) ?? 0) + 1);
  const junctions = [...uses.values()].filter((n) => n > 1).length;
  const added = all.filter((way) => way.id < 0).length;
  $("#path-count").textContent = all.length;
  $("#path-filename").textContent = all.length ? connection?.name ?? DEFAULT_FILE : "No map yet";
  $("#path-file-detail").textContent = all.length ? `${all.length} paths · ${uses.size} nodes · JSON` : "JSON from OSM or a file";
  $("#path-stats").hidden = !all.length;
  $("#path-stats").innerHTML = `<span><strong>${all.length}</strong> paths</span><span><strong>${junctions}</strong> junctions</span><span><strong>${added}</strong> new</span>`;
  $("#path-undo").disabled = !undo.length;
  $("#path-redo").disabled = !redo.length;
  $("#path-osm").disabled = busy;
  $("#path-download").disabled = !all.length;
  const changes = dirty();
  $("#path-status").textContent = all.length ? (changes ? "Changes not downloaded yet" : "Matches your last file") : "";
  $("#path-status").classList.toggle("has-changes", changes);
  renderLines();
  renderList();
  renderEditor();
}

function style(way) {
  const selected = way.id === selectedId;
  return {
    color: selected ? "#b84e2f" : isFoot(way) ? "#468469" : "#558394",
    weight: selected ? 6 : 4,
    opacity: selected ? 1 : 0.8,
    dashArray: way.id < 0 ? "8 5" : null,
  };
}

function renderLines() {
  const current = new Map(ways(doc).map((way) => [way.id, way]));
  for (const [id, line] of lines)
    if (!current.has(id)) {
      line.remove();
      lines.delete(id);
    }
  for (const way of current.values()) {
    let line = lines.get(way.id);
    if (!line) {
      line = L.polyline([], { interactive: true }).addTo(map);
      line.on("click", (event) => {
        if (drawing) return;
        L.DomEvent.stop(event);
        select(way.id);
      });
      lines.set(way.id, line);
    }
    line.setLatLngs(way.geometry.map((p) => [p.lat, p.lon])).setStyle(style(way));
    line.unbindTooltip().bindTooltip(escape(wayName(way)), { sticky: true });
  }
  lines.get(selectedId)?.bringToFront();
  renderHandles();
}

function renderHandles() {
  handles.clearLayers();
  const way = ways(doc).find((w) => w.id === selectedId);
  if (!way || drawing) return;
  way.geometry.forEach((p, index) => {
    const nodeId = way.nodes[index];
    const shared = ways(doc).filter((w) => w.nodes.includes(nodeId)).length > 1;
    const handle = L.marker([p.lat, p.lon], {
      draggable: true,
      keyboard: true,
      title: shared ? `Junction ${nodeId}` : `Point ${nodeId}`,
      icon: L.divIcon({ className: `gate-marker ${shared ? "new" : "edited"}`, html: "<span></span>", iconSize: [14, 14], iconAnchor: [7, 7] }),
    });
    handle.on("dragend", () => {
      const { lat, lng } = handle.getLatLng();
      commit(moveNode(doc, nodeId, lat, lng));
    });
    handle.on("click", (event) => {
      if (!event.originalEvent.shiftKey) return;
      commit(removeVertex(doc, way.id, index));
      if (!ways(doc).some((w) => w.id === way.id)) selectedId = null;
      render();
    });
    handles.addLayer(handle);
  });
  // A "+" in the middle of each stretch: click to add a point there, or drag it to where it belongs.
  for (let index = 1; index < way.geometry.length; index++) {
    const [a, b] = [way.geometry[index - 1], way.geometry[index]];
    // Only where there is room on screen; zooming in shows the rest.
    if (map.latLngToContainerPoint([a.lat, a.lon]).distanceTo(map.latLngToContainerPoint([b.lat, b.lon])) < 40) continue;
    const add = L.marker([(a.lat + b.lat) / 2, (a.lon + b.lon) / 2], {
      draggable: true,
      keyboard: true,
      title: "Add a point here",
      icon: L.divIcon({ className: "insert-handle", html: "<span>+</span>", iconSize: [16, 16], iconAnchor: [8, 8] }),
    });
    const insert = () => {
      const { lat, lng } = add.getLatLng();
      commit(insertVertex(doc, way.id, index, lat, lng));
    };
    add.on("click", insert);
    add.on("dragend", insert);
    handles.addLayer(add);
  }
}

const matchesFilter = (way) =>
  filter === "all" || (filter === "new" ? way.id < 0 : filter === "foot" ? isFoot(way) : !isFoot(way));

function renderList() {
  const all = ways(doc);
  const shown = all.filter((way) => matchesFilter(way) && `${wayName(way)} ${way.tags?.highway ?? ""} ${way.id}`.toLowerCase().includes(search));
  $("#path-shown").textContent = `${shown.length} shown`;
  $("#path-list").innerHTML = shown.length
    ? shown
        .map(
          (way) =>
            `<button class="point-row ${way.id === selectedId ? "selected" : ""}" data-way="${way.id}" aria-pressed="${way.id === selectedId}"><span class="point-symbol ${way.id < 0 ? "new" : ""}">${icon("route")}</span><span class="point-row-text"><strong>${escape(wayName(way))}</strong><small>${escape(way.tags?.highway ?? "no highway tag")} · ${way.nodes.length} points${way.id < 0 ? '<span class="status-label new">new</span>' : ""}</small></span>${icon("arrow")}</button>`,
        )
        .join("")
    : all.length
      ? `<div class="empty-list">${icon("search")}<strong>No matching paths</strong><p>Try another search or filter.</p></div>`
      : `<div class="empty-list">${icon("route")}<strong>Your map starts here</strong><p>Download campus paths from OpenStreetMap, or upload a map file.</p><button id="path-empty-osm" class="primary" ${busy ? "disabled" : ""}>${icon("globe")} Download from OSM</button></div>`;
}

function renderEditor() {
  const way = ways(doc).find((w) => w.id === selectedId);
  $("#path-editor").hidden = !way;
  if (!way) return;
  const osm = way.id > 0 ? `<a href="https://www.openstreetmap.org/way/${way.id}" target="_blank" rel="noreferrer">OSM way ${way.id}</a>` : "New path";
  $("#path-editor").innerHTML = `<div class="editor-heading"><div><div class="eyebrow">${osm}</div><h2>${escape(wayName(way))}</h2></div><button class="icon-button" id="path-close" aria-label="Close path details">${icon("close")}</button></div>
    <form><label>Tags, one key=value per line<textarea name="tags" rows="8" spellcheck="false">${escape(formatTags(way.tags))}</textarea></label><p id="path-form-error" class="form-error" role="alert"></p><button class="primary full-width" type="submit">Apply tags</button></form>
    <div class="editor-footer"><span class="muted">${way.nodes.length} points</span><button id="path-delete" class="text-danger">Remove path</button></div>`;
}

function select(id, pan = false) {
  selectedId = id;
  render();
  const line = lines.get(id);
  if (pan && line) map.fitBounds(line.getBounds(), { maxZoom: 19, padding: [80, 80] });
}

function fit() {
  const all = [...lines.values()];
  if (all.length) map.fitBounds(L.featureGroup(all).getBounds(), { padding: [40, 40] });
}

// ---- drawing ---------------------------------------------------------------------------------

function nearestNode(latlng) {
  const at = map.latLngToContainerPoint(latlng);
  let best = null, bestDistance = SNAP_PIXELS;
  for (const way of ways(doc))
    way.geometry.forEach((p, i) => {
      const distance = map.latLngToContainerPoint([p.lat, p.lon]).distanceTo(at);
      if (distance < bestDistance) [best, bestDistance] = [{ id: way.nodes[i], lat: p.lat, lon: p.lon }, distance];
    });
  return best;
}

function startDrawing() {
  stopPicking();
  drawing = [];
  selectedId = null;
  map.doubleClickZoom.disable();
  $("#path-map").classList.add("placing");
  $("#path-add").innerHTML = `${icon("close")} Cancel adding`;
  render();
  renderBanner();
}

function renderBanner() {
  $("#path-banner").hidden = !drawing && !picking;
  if (picking)
    $("#path-banner").innerHTML = `Drag a rectangle over the area to download. <button id="path-campus">Whole campus</button><button id="path-cancel-area">Cancel <kbd>Esc</kbd></button>`;
  else if (drawing)
    $("#path-banner").innerHTML = `Click to add points. Clicks near an existing point join it. <button id="path-finish" ${drawing.length < 2 ? "disabled" : ""}>Finish <kbd>Enter</kbd></button><button id="path-cancel">Cancel <kbd>Esc</kbd></button>`;
}

function stopDrawing() {
  drawing = null;
  draft.setLatLngs([]);
  map.doubleClickZoom.enable();
  $("#path-map").classList.remove("placing");
  $("#path-add").innerHTML = `${icon("plus")} Add path`;
  renderBanner();
  render();
}

function startPicking() {
  if (drawing) stopDrawing();
  picking = { start: null, box: L.rectangle([[0, 0], [0, 0]], { color: "#b84e2f", weight: 2, dashArray: "6 4", fillOpacity: 0.08, interactive: false }) };
  map.dragging.disable();
  map.boxZoom.disable();
  $("#path-map").classList.add("placing");
  renderBanner();
}

function stopPicking() {
  if (!picking) return;
  picking.box.remove();
  picking = null;
  map.dragging.enable();
  map.boxZoom.enable();
  $("#path-map").classList.remove("placing");
  renderBanner();
}

function finishDrawing() {
  if (!drawing || drawing.length < 2) return toast("A path needs at least two points.");
  const { doc: next, id } = addWay(doc, drawing);
  stopDrawing();
  commit(next);
  select(id);
  toast("Path added as highway=footway. Edit its tags if needed.");
}

// ---- OSM and files --------------------------------------------------------------------------

async function run(task) {
  busy = true;
  render();
  try {
    await task();
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
    render();
  }
}

// The file is an Overpass snapshot: nodes and paths together.
function download() {
  const url = URL.createObjectURL(new Blob([toText(doc)], { type: "application/json" }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: connection?.name ?? DEFAULT_FILE });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  connection = { name: anchor.download, text: toText(doc) };
  saveDraft();
  render();
}

// data/ is published with the site, so the repo's copy sits next to the page.
function loadRepo(ask = true) {
  if (ask && dirty() && !confirm("Loading replaces the map in this editor, including changes not downloaded yet. Continue?")) return;
  return run(async () => {
    const response = await fetch(`./${DEFAULT_FILE}`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${DEFAULT_FILE} from the repo.`);
    const next = checkSnapshot(await response.text());
    replaceDoc(next, { name: DEFAULT_FILE, text: toText(next) });
    if (ask) toast(`Loaded ${ways(doc).length} paths from the repo.`);
  });
}

async function upload(input) {
  const file = input.files[0];
  input.value = "";
  if (!file) return;
  if (dirty() && !confirm("Uploading replaces the map in this editor, including unsaved edits. Continue?")) return;
  try {
    const next = checkSnapshot(await file.text());
    replaceDoc(next, { name: file.name, text: toText(next) });
    toast(`Loaded ${ways(doc).length} paths from ${file.name}.`);
  } catch (error) {
    toast(`${file.name}: ${error.message}`);
  }
}

// Straight from the browser: Overpass allows cross-origin requests.
async function fetchOsm(bbox) {
  const body = `data=${encodeURIComponent(overpassQuery(bbox))}`;
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(45000) });
      if (response.ok) return await response.text();
    } catch {
      /* Busy or unreachable: try the next server. */
    }
  }
  throw new Error("OpenStreetMap is busy right now. Try again in a minute.");
}

function downloadOsm(bbox) {
  if (dirty() && !confirm("Downloading replaces the map in this editor, including unsaved edits. Continue?")) return;
  return run(async () => {
    toast("Downloading paths from OpenStreetMap…");
    const text = await fetchOsm(bbox);
    if (new TextEncoder().encode(text).byteLength > MAX_SNAPSHOT_BYTES) throw new Error("That area has too much map data. Draw a smaller rectangle.");
    const next = checkSnapshot(text);
    if (!ways(next).length) throw new Error("No paths in that area. Draw a rectangle over campus.");
    replaceDoc(next, null);
    toast(`Downloaded ${ways(doc).length} paths. Use Download file to keep them.`);
  });
}

