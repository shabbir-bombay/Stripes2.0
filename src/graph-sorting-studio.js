import L from "leaflet";
import { setupColoringPanel } from "./edge-coloring-panel.js";
import { EDGE_FIELDS, edgeCount, edgeTagLabel, insertEdgeNode, paintEdge, tagColor } from "./edge-editing.js";
import { SORTING_SHORTCUTS, sortingShortcut } from "./sorting-shortcuts.js";
import { icon } from "./icons.js";
import { setupBasemap } from "./basemap.js";
import { toText, wayName, ways, deleteWay, moveNode, MAX_SNAPSHOT_BYTES } from "./paths.js";
import { COMBINATIONS, ROAD_TYPES, ROAD_TAG, SORTING_STORAGE_KEY, addCrossingJunction, addJunction, checkSortingSnapshot, classifyRoads, connectNodes, deleteGraphNode, extendRoad, graphNodes, findNearMisses, isJunction, snapNodeToRoad, mergeNodes, roadMask, roadStyle } from "./graph-sorting.js";

const $ = (s) => document.querySelector(s);
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const DEFAULT_FILE = "campus-sorted.json";
let started = false, map, toast;
let hasGraph = false, pendingDeletion = null, nearMisses = null, reviewTarget = null;
let doc = { elements: [] }, undo = [], redo = [];
let selectedWay = null, selectedNode = null, operation = null, search = "", filter = "all";
let brush = null, renderedColorKey = ROAD_TAG;
let layers, nodeLayers, nodes = new Map(), roadById = new Map();

export function showGraphSorting(showToast) {
  toast = showToast;
  if (!started) start();
  map.invalidateSize();
}

function start() {
  started = true;
  $("#sorting-actions").innerHTML = `<button id="sorting-import">${icon("upload")} Upload graph</button><button id="sorting-download">${icon("download")} Download</button><input id="sorting-file" type="file" accept=".json,application/json" hidden>`;
  $("#sorting-workspace").innerHTML = `
    <aside class="sidebar sorting-sidebar" aria-label="Graph sorting controls">
      <div class="sidebar-top"><div class="eyebrow">PATH STUDIO / STEP 02</div><div class="title-row"><h1>Graph Sorting</h1><span class="count" id="sorting-count">0</span></div><p class="muted">Choose who can use each road.</p>
        <button id="sorting-copy" class="full-width">${icon("route")} Copy from Graphing</button>
        <p class="sorting-note">A separate sorting draft. Your graphing stays intact. Download to keep a copy.</p>
        <div class="sorting-progress"><span id="sorting-progress-label"></span><progress id="sorting-progress" max="1" value="0" aria-label="Classified edges"></progress></div>
        <div class="sorting-gap-tools"><label>Find gaps within<select id="sorting-gap-distance"><option value="1">1 m</option><option value="3">3 m</option><option value="5" selected>5 m</option><option value="10">10 m</option></select></label><button id="sorting-find-gaps">Find gaps</button></div>
        <details id="sorting-gaps" hidden><summary id="sorting-gap-count"></summary><p class="sorting-note">Possible missed connections. Review before snapping.</p><div id="sorting-gap-list"></div></details>
        <div class="sorting-edit-modes"><button id="sorting-color-mode" aria-pressed="false">Color edges</button><button id="sorting-insert-mode" aria-pressed="false">Insert node</button></div>
        <section id="sorting-paint-panel" aria-label="Edge coloring settings" hidden></section>
        <label class="search-box">${icon("search")}<input id="sorting-search" type="search" placeholder="Search road or node ID…" aria-label="Search sorting roads"></label>
        <div class="filter-row"><label class="sr-only" for="sorting-filter">Filter sorting roads</label><select id="sorting-filter"><option value="all">All roads</option><option value="0">Unclassified</option>${COMBINATIONS.slice(1).map((c) => `<option value="${c.mask}">${c.label}</option>`).join("")}</select><span id="sorting-shown"></span></div>
      </div>
      <div class="point-list" id="sorting-list"></div>
      <details class="sorting-legend" open><summary>Color legend <span id="sorting-color-label">Allowed users</span></summary><div id="sorting-legend-items">${COMBINATIONS.map((c) => `<div class="sorting-legend-row"><i style="background:${c.color}"></i><span>${c.label}</span><small data-count="${c.mask}">0</small></div>`).join("")}</div><p>J marks a connected junction. Split colors show different road classifications.</p></details>
      <div class="sidebar-bottom"><span id="sorting-storage" role="status">Draft saved in this browser</span><div class="github-actions"><button id="sorting-shortcuts">Keyboard shortcuts <kbd>?</kbd></button></div></div>
    </aside>
    <section class="map-workspace" aria-label="Interactive graph sorting map">
      <div id="sorting-map" aria-label="Road classification map"></div>
      <div class="map-toolbar sorting-toolbar"><div id="sorting-basemap" class="segmented" aria-label="Sorting map style"></div><div class="map-actions"><div class="history-buttons"><button id="sorting-undo" aria-label="Undo sorting" title="Undo (⌘/Ctrl Z)">${icon("undo")}</button><button id="sorting-redo" aria-label="Redo sorting" title="Redo (⌘/Ctrl Shift Z)">${icon("redo")}</button></div><button id="sorting-fit">${icon("fit")} Fit graph</button><button id="sorting-junction" class="dark">${icon("plus")} Add junction</button></div></div>
      <div id="sorting-banner" class="sorting-banner" role="status" hidden></div>
      <section id="sorting-editor" class="editor sorting-editor" aria-label="Road classification" hidden></section>
      <div class="sorting-map-note">Click any node or road to classify it.</div>
    </section>
    <dialog id="sorting-shortcuts-dialog" aria-labelledby="sorting-shortcuts-title"><h2 id="sorting-shortcuts-title">Keyboard shortcuts</h2><p>Single keys work in Graph Sorting. All shortcuts pause while an input, text area, dropdown, or editable field has focus. Node tools need a selected node; Extend needs an endpoint.</p><div class="sorting-shortcut-list">${SORTING_SHORTCUTS.map((shortcut) => `<div><kbd>${shortcut.key === "Escape" ? "Esc" : shortcut.key.toUpperCase()}</kbd><span>${shortcut.label}</span></div>`).join("")}</div><p>K toggles Coloring. I inserts a node. Keys 1–4 set the paint users in Coloring mode; otherwise A applies the selected road’s checkboxes. ⌘/Ctrl Z and ⌘/Ctrl Shift Z still work outside fields.</p><form method="dialog" class="dialog-actions"><button autofocus>Close</button></form></dialog>
    <dialog id="sorting-delete-dialog" aria-labelledby="sorting-delete-title"><h2 id="sorting-delete-title"></h2><p id="sorting-delete-description"></p><p>You can undo this deletion.</p><div class="dialog-actions"><button id="sorting-delete-cancel" autofocus>Cancel</button><button id="sorting-delete-confirm" class="danger">Delete</button></div></dialog>`;
  map = L.map("sorting-map", { zoomControl: false, maxZoom: 22, preferCanvas: true }).setView([37.9795, -121.311], 16);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
  layers = L.layerGroup().addTo(map);
  nodeLayers = L.layerGroup().addTo(map);
  brush = setupColoringPanel($("#sorting-paint-panel"), () => {
    if (brush && operation === "color") { renderMap(); renderList(); renderLegend(); renderShortcutHints(); }
  });
  $("#sorting-color-mode").onclick = () => { operation = operation === "color" ? null : "color"; selectedNode = null; render(); };
  $("#sorting-insert-mode").onclick = () => { operation = operation === "insert" ? null : "insert"; render(); };
  setupBasemap(map, $("#sorting-basemap"), { overlay: () => ({ type: "FeatureCollection", features: ways(doc).map((way) => ({ type: "Feature", properties: { color: displayStyle(way).color }, geometry: { type: "LineString", coordinates: way.geometry.map((p) => [p.lon, p.lat]) } })) }) });
  new ResizeObserver(() => map.invalidateSize()).observe($("#sorting-map"));
  $("#sorting-copy").onclick = () => copyGraph();
  $("#sorting-import").onclick = () => $("#sorting-file").click();
  $("#sorting-file").onchange = async (event) => {
    const file = event.target.files[0]; event.target.value = "";
    if (!file || !canReplace()) return;
    try {
      if (file.size > MAX_SNAPSHOT_BYTES) throw new Error("Map files must be smaller than 1 MB.");
      replace(checkSortingSnapshot(await file.text()));
      toast(`Loaded ${file.name}. Road classifications are preserved when present.`);
    } catch (error) { toast(error.message); }
  };
  $("#sorting-download").onclick = () => {
    const url = URL.createObjectURL(new Blob([toText(doc)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: DEFAULT_FILE }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  $("#sorting-fit").onclick = fit;
  $("#sorting-shortcuts").onclick = () => $("#sorting-shortcuts-dialog").showModal();
  $("#sorting-find-gaps").onclick = () => act(() => {
    nearMisses = findNearMisses(doc, Number($("#sorting-gap-distance").value));
    renderGaps(); $("#sorting-gaps").open = true;
    if (!nearMisses.length) toast("No unconnected nodes found within this distance. This is not a full connectivity check.");
  });
  $("#sorting-gap-list").onclick = (event) => {
    const button = event.target.closest("[data-gap]");
    if (!button) return;
    const hit = nearMisses?.[Number(button.dataset.gap)];
    if (!hit) return;
    selectedNode = hit.nodeId; selectedWay = nodes.get(hit.nodeId).ways[0]; reviewTarget = hit.wayId; operation = null;
    render();
    const node = nodes.get(hit.nodeId);
    map.fitBounds([[node.lat, node.lon], [hit.position.lat, hit.position.lon]], { maxZoom: 21, padding: [60, 60], paddingBottomRight: [330, 60] });
  };
  $("#sorting-delete-cancel").onclick = () => $("#sorting-delete-dialog").close();
  $("#sorting-delete-dialog").onclose = () => { pendingDeletion = null; };
  $("#sorting-delete-confirm").onclick = () => act(() => {
    if (!pendingDeletion) return;
    const { before, next, message } = pendingDeletion;
    $("#sorting-delete-dialog").close();
    if (before !== doc) return toast("The graph changed. Select the item and delete it again.");
    operation = null;
    commit(next);
    toast(message);
  });
  $("#sorting-junction").onclick = startJunction;
  $("#sorting-undo").onclick = () => step(false);
  $("#sorting-redo").onclick = () => step(true);
  $("#sorting-search").oninput = (event) => { search = event.target.value.toLowerCase(); renderList(); };
  $("#sorting-filter").onchange = (event) => { filter = event.target.value; renderList(); };
  $("#sorting-list").onclick = (event) => {
    const button = event.target.closest("[data-road]");
    if (!button) return;
    selectedWay = Number(button.dataset.road); selectedNode = null; operation = null; reviewTarget = null; render();
    map.fitBounds(roadById.get(selectedWay).geometry.map((p) => [p.lat, p.lon]), { maxZoom: 19, padding: [60, 60], paddingBottomRight: [330, 60] });
  };
  $("#sorting-editor").onchange = (event) => {
    if (event.target.id === "sorting-node") {
      selectedNode = event.target.value === "" ? null : Number(event.target.value); operation = null; reviewTarget = null; render();
    }
    if (event.target.id === "sorting-road-choice") { selectedWay = Number(event.target.value); render(); }
  };
  $("#sorting-editor").onsubmit = (event) => {
    event.preventDefault();
    const types = new FormData(event.target).getAll("roadType");
    act(() => {
      commit(classifyRoads(doc, [selectedWay], types));
      toast(`Road classified: ${roadStyle(roadById.get(selectedWay)).label}.`);
    });
  };
  $("#sorting-editor").onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "sorting-close") { selectedWay = selectedNode = operation = null; render(); }
    if (button.id === "sorting-snap-reviewed") finishSnap(reviewTarget);
    if (button.id === "sorting-delete-node") confirmDeletion("node");
    if (button.id === "sorting-delete-path") confirmDeletion("path");
    if (button.id === "sorting-clear") commit(classifyRoads(doc, [selectedWay], []));
    if (button.dataset.operation === "junction") startJunction();
    else if (button.dataset.operation) { operation = button.dataset.operation; renderBanner(); }
  };
  $("#sorting-banner").onclick = () => { operation = null; renderBanner(); };
  map.on("click", ({ latlng }) => {
    if (operation === "move") return finishMove(latlng);
    if (operation === "junction") return placeJunction(latlng);
    if (operation !== "extend") return;
    act(() => {
      const result = extendRoad(doc, selectedWay, selectedNode, { lat: latlng.lat, lon: latlng.lng });
      selectedNode = result.nodeId; operation = null; commit(result.doc);
    });
  });
  document.addEventListener("keydown", (event) => {
    const key = sortingShortcut(event, {
      activeElement: document.activeElement,
      studio: document.body.dataset.studio,
      dialogOpen: Boolean(document.querySelector("dialog[open]")),
      viewOnly: $("#sorting-map").closest(".map-workspace").classList.contains("is-3d"),
    });
    if (!key) return;
    if (key === "Escape") { event.preventDefault(); operation = null; renderBanner(); return; }
    const shortcut = SORTING_SHORTCUTS.find((shortcut) => shortcut.key === key);
    const selector = operation === "color" && /^[1-4]$/.test(key)
      ? `input[name="brushRoadType"][value="${ROAD_TYPES[Number(key) - 1].id}"]` : shortcut.selector;
    const control = $(selector);
    if (!control || control.disabled || !control.checkVisibility()) return;
    event.preventDefault();
    if (key === "/") control.focus();
    else control.click();
  });

  try {
    const saved = JSON.parse(localStorage.getItem(SORTING_STORAGE_KEY) ?? "null");
    if (saved?.doc) { doc = checkSortingSnapshot(toText(saved.doc)); hasGraph = true; }
    else copyGraph(false);
  } catch (error) { toast(`Could not restore the sorting draft: ${error.message}`); }
  render(); fit();
}

function act(fn) { try { fn(); } catch (error) { toast(error.message); } }
function persist() {
  try { localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify({ doc })); $("#sorting-storage").textContent = "Draft saved in this browser"; }
  catch { $("#sorting-storage").textContent = "Draft not saved — download a copy"; toast("Browser storage is unavailable or full. Download your sorted graph to keep it."); }
}
function commit(next) {
  checkSortingSnapshot(toText(next));
  hasGraph = true; nearMisses = null; reviewTarget = null;
  undo.push(doc); if (undo.length > 80) undo.shift(); redo = []; doc = next; persist(); render();
}
function step(forward) {
  const [from, to] = forward ? [redo, undo] : [undo, redo];
  if (!from.length) return;
  to.push(doc); doc = from.pop(); if (operation !== "color" && operation !== "insert") operation = null; nearMisses = null; reviewTarget = null; persist(); render();
}
function canReplace() { return !ways(doc).length || confirm("Replace the sorting draft? Download it first to keep a copy. Graphing will not change."); }
function replace(next) {
  hasGraph = true; nearMisses = null; reviewTarget = null;
  undo = []; redo = []; doc = next; selectedWay = selectedNode = operation = null;
  search = ""; filter = "all"; $("#sorting-search").value = ""; $("#sorting-filter").value = "all";
  persist(); render(); fit();
}
function copyGraph(ask = true) {
  act(() => {
    const saved = JSON.parse(localStorage.getItem("stripes-path-studio-v1") ?? "null");
    if (!saved?.doc?.elements?.length) { if (ask) toast("Open or draw your graph in Graphing first, then copy it here."); return; }
    const next = checkSortingSnapshot(toText(saved.doc));
    if (ask && !canReplace()) return;
    replace(next);
    if (ask) toast("Copied your graph into its own sorting draft.");
  });
}
function fit() {
  const points = ways(doc).flatMap((way) => way.geometry.map((p) => [p.lat, p.lon]));
  if (points.length) map.fitBounds(points, { padding: [45, 45], maxZoom: 19 });
}

function render() {
  roadById = new Map(ways(doc).map((way) => [way.id, way])); nodes = graphNodes(doc);
  if (!roadById.has(selectedWay)) selectedWay = null;
  if (!nodes.has(selectedNode)) selectedNode = null;
  const totalEdges = ways(doc).reduce((count, way) => count + edgeCount(way), 0);
  const classifiedEdges = ways(doc).reduce((count, way) => count + (roadMask(way) ? edgeCount(way) : 0), 0);
  $("#sorting-count").textContent = ways(doc).length;
  $("#sorting-progress-label").textContent = `${classifiedEdges} of ${totalEdges} edges classified`;
  $("#sorting-progress").max = totalEdges || 1; $("#sorting-progress").value = classifiedEdges;
  $("#sorting-undo").disabled = !undo.length; $("#sorting-redo").disabled = !redo.length;
  $("#sorting-download").disabled = !hasGraph;
  $("#sorting-junction").disabled = ways(doc).length < 2;
  $("#sorting-color-mode").disabled = $("#sorting-insert-mode").disabled = !totalEdges;
  renderList(); renderMap(); renderEditor(); renderBanner(); renderGaps(); renderLegend(); renderShortcutHints();
}
function renderList() {
  const shown = ways(doc).filter((way) => (filter === "all" || roadMask(way) === Number(filter)) && `${wayName(way)} ${way.id} ${way.nodes.join(" ")}`.toLowerCase().includes(search));
  $("#sorting-shown").textContent = `${shown.length} shown`;
  $("#sorting-list").innerHTML = shown.length ? shown.map((way) => `<button class="point-row ${way.id === selectedWay ? "selected" : ""}" data-road="${way.id}" aria-pressed="${way.id === selectedWay}"><i class="sorting-swatch" style="background:${displayStyle(way).color}"></i><span class="point-row-text"><strong>${escape(wayName(way))}</strong><small>${escape(displayStyle(way).label)} · ${edgeCount(way)} edge(s)</small></span>${icon("arrow")}</button>`).join("") : `<div class="empty-list"><strong>${ways(doc).length ? "No matching roads" : "Ready for your graph"}</strong><p>${ways(doc).length ? "Try another search or filter." : "Copy from Graphing or upload a JSON graph."}</p></div>`;
}
function renderMap() {
  renderedColorKey = colorKey();
  layers.clearLayers(); nodeLayers.clearLayers();
  for (const way of ways(doc)) {
    if (way.id === selectedWay) L.polyline(way.geometry.map((p) => [p.lat, p.lon]), { color: "#fff", weight: 10, interactive: false }).addTo(layers);
    for (let edgeIndex = 0; edgeIndex < edgeCount(way); edgeIndex++) {
      const style = displayStyle(way);
      const line = L.polyline(way.geometry.slice(edgeIndex, edgeIndex + 2).map((p) => [p.lat, p.lon]), { color: style.color, weight: way.id === selectedWay ? 6 : 4, opacity: 1, dashArray: way.tags?.highway === "steps" ? "5 5" : null, bubblingMouseEvents: false }).addTo(layers);
      line.bindTooltip(`${escape(wayName(way))} · Edge ${edgeIndex + 1} · ${escape(style.label)}${way.tags?.highway === "steps" ? " · Stairs" : ""}`, { sticky: true });
      line.on("click", ({ latlng }) => {
        if (operation === "color") return act(() => {
          const next = paintEdge(doc, way.id, edgeIndex, brush.patch());
          selectedWay = next.id; selectedNode = null;
          if (next.changed) { commit(next.doc); toast("Edge painted. Other edges and settings are unchanged."); }
          else toast("This edge already has that setting.");
        });
        if (operation === "insert") return act(() => {
          const next = insertEdgeNode(doc, way.id, edgeIndex, { lat: latlng.lat, lon: latlng.lng });
          selectedWay = way.id; selectedNode = next.nodeId;
          if (next.changed) { commit(next.doc); toast("Node inserted. Both edges retain their settings. Press K to color them separately."); }
          else toast("A node already exists here. Click between nodes.");
        });
        if (operation === "move") return finishMove(latlng);
        if (operation === "junction") return placeJunction(latlng);
        if (operation === "snap") return finishSnap(way.id);
        if (operation === "branch") return act(() => {
          const next = addJunction(doc, selectedNode, way.id, { lat: latlng.lat, lon: latlng.lng });
          selectedWay = next.id; selectedNode = next.nodeId; operation = null; commit(next.doc);
          toast("Junction added. The roads now share a connected node.");
        });
        if (operation) return;
        selectedWay = way.id; selectedNode = null; render();
      });
    }
  }

  for (const node of nodes.values()) {
    const colors = [...new Set(node.ways.map((id) => displayStyle(roadById.get(id)).color))];
    const fill = colors.length === 1 ? colors[0] : `conic-gradient(${colors.map((color, i) => `${color} ${i * 100 / colors.length}% ${(i + 1) * 100 / colors.length}%`).join(",")})`;
    const junction = isJunction(node), size = node.id === selectedNode ? 20 : junction ? 17 : 12;
    const marker = L.marker([node.lat, node.lon], { draggable: !operation, keyboard: true, bubblingMouseEvents: false, title: `${junction ? "Junction" : "Node"} ${node.id}`, icon: L.divIcon({ className: `sorting-node ${junction ? "junction" : ""} ${node.id === selectedNode ? "selected" : ""}`, html: `<span style="background:${fill}">${junction ? "J" : ""}</span>`, iconSize: [size, size] }) }).addTo(nodeLayers);
    marker.bindTooltip(`${junction ? "Junction" : "Node"} ${node.id} · ${node.ways.length} path(s) · ${node.ways.map((id) => escape(displayStyle(roadById.get(id)).label)).filter((v, i, a) => a.indexOf(v) === i).join(" / ")}`);
    marker.on("dragend", () => {
      selectedNode = node.id;
      if (!node.ways.includes(selectedWay)) selectedWay = node.ways[0];
      finishMove(marker.getLatLng());
    });
    marker.on("click", (event) => { L.DomEvent.stop(event.originalEvent); selectNode(node.id); });
  }
}
function selectNode(id) {
  act(() => {
    if (operation === "color" || operation === "insert") return toast("Click the edge between nodes. Esc exits this mode.");
    if (operation === "move") return toast("Click an empty location to move, or cancel and use Snap / Merge to join another node.");
    if (operation === "junction") {
      const node = nodes.get(id);
      return placeJunction(L.latLng(node.lat, node.lon));
    }
    if (operation === "snap") {
      const target = nodes.get(id).ways.find((wayId) => !roadById.get(wayId).nodes.includes(selectedNode));
      if (target === undefined) throw new Error("Choose a road this node is not already connected to.");
      return finishSnap(target);
    }
    reviewTarget = null;
    if (operation === "connect" || operation === "branch") {
      const next = connectNodes(doc, selectedNode, id); selectedWay = next.id; selectedNode = id; operation = null; commit(next.doc); toast("Connection added. Choose its road types."); return;
    }
    if (operation === "merge") {
      if (!confirm(`Merge node ${selectedNode} into node ${id}? Connected roads will meet at the target location. Undo is available.`)) return;
      const next = mergeNodes(doc, selectedNode, id); selectedNode = id; operation = null; commit(next); toast("Nodes merged into one junction."); return;
    }
    if (operation === "extend") {
      const next = extendRoad(doc, selectedWay, selectedNode, { id }); selectedNode = id; operation = null; commit(next.doc); toast("Road extended to the selected node."); return;
    }
    selectedNode = id;
    if (!nodes.get(id).ways.includes(selectedWay)) selectedWay = nodes.get(id).ways[0];
    render();
  });
}
function renderEditor() {
  const way = roadById.get(selectedWay), node = nodes.get(selectedNode);
  $("#sorting-editor").hidden = !way || operation === "color" || operation === "insert";
  if (!way) return;
  const style = roadStyle(way), canExtend = node && (way.nodes[0] === node.id || way.nodes.at(-1) === node.id);
  $("#sorting-editor").innerHTML = `<div class="editor-heading"><div><div class="eyebrow">${node ? `NODE ${node.id}` : `ROAD ${way.id}`}</div><h2>${escape(wayName(way))}</h2></div><button id="sorting-close" class="icon-button" aria-label="Close classification">${icon("close")}</button></div>
    ${node?.ways.length > 1 ? `<label class="sorting-field">Road at this junction<select id="sorting-road-choice">${node.ways.map((id) => `<option value="${id}" ${id === way.id ? "selected" : ""}>${escape(wayName(roadById.get(id)))} · ${id}</option>`).join("")}</select></label><p class="sorting-note">This node joins ${node.ways.length} roads. Classify each road separately.</p>` : ""}
    ${node ? `<p class="sorting-node-status">${isJunction(node) ? "Junction" : "Not a junction"} · ${node.ways.length} connected path(s)</p>` : ""}
    ${node && reviewTarget !== null && roadById.has(reviewTarget) && !node.ways.includes(reviewTarget) ? `<div class="sorting-snap-review"><p>Review connection to <strong>${escape(wayName(roadById.get(reviewTarget)))}</strong></p><button id="sorting-snap-reviewed">Snap to this road</button></div>` : ""}
    <div class="sorting-current"><i class="sorting-swatch" style="background:${style.color}"></i>${style.label}</div>
    <form><fieldset class="sorting-types"><legend>Allowed road users <span>Select any combination</span></legend>${ROAD_TYPES.map((type) => `<label><input type="checkbox" name="roadType" value="${type.id}" ${style.types.includes(type.id) ? "checked" : ""}><span>${type.label}</span></label>`).join("")}</fieldset><p class="sorting-note">Applies to this entire road (${way.nodes.length} nodes).</p><button class="primary full-width" type="submit">Apply road types</button></form>
    <button id="sorting-clear" class="sorting-clear" ${style.mask ? "" : "disabled"}>Reset to unclassified</button>
    <div class="sorting-topology"><h3>Extend & connect</h3><label class="sorting-field">Selected node<select id="sorting-node"><option value="">Choose a node…</option>${[...new Set(way.nodes)].map((id) => `<option value="${id}" ${selectedNode === id ? "selected" : ""}>Node ${id}${id === way.nodes[0] || id === way.nodes.at(-1) ? " · endpoint" : ""}</option>`).join("")}</select></label><div class="sorting-topology-buttons"><button data-operation="extend" ${canExtend ? "" : "disabled"}>Extend road</button><button data-operation="connect" ${node ? "" : "disabled"}>Connect nodes</button><button data-operation="junction">Add junction</button><button data-operation="branch" ${node ? "" : "disabled"}>Branch to road</button><button data-operation="move" ${node ? "" : "disabled"}>Move node</button><button data-operation="snap" ${node ? "" : "disabled"}>Snap node to road</button><button data-operation="merge" ${node ? "" : "disabled"}>Merge nodes</button></div><p class="sorting-note">Add junction works at a crossing without selecting a node. Drag a node to move it. Moving preserves existing connections; use Snap node to road to close small gaps and create a shared junction. Branch to road adds a connecting path.</p></div>
    <div class="sorting-delete-actions"><button id="sorting-delete-node" class="text-danger" ${node ? "" : "disabled"}>${icon("trash")} Delete node</button><button id="sorting-delete-path" class="text-danger">${icon("trash")} Delete path</button></div>`;
}
function colorKey() { return operation === "color" && brush ? brush.read().key : ROAD_TAG; }
function displayStyle(way) {
  const key = colorKey();
  return key === ROAD_TAG ? roadStyle(way) : { color: tagColor(way.tags?.[key]), label: edgeTagLabel(key, way.tags?.[key]) };
}
function renderLegend() {
  const key = colorKey();
  $("#sorting-color-label").textContent = key === ROAD_TAG ? "Allowed users · edges" : `${EDGE_FIELDS.find(field => field.key === key)?.label ?? (key || "Custom tag")} · edges`;
  const values = key === ROAD_TAG ? COMBINATIONS.map((c) => ({ ...c, count: ways(doc).reduce((n, way) => n + (roadMask(way) === c.mask ? edgeCount(way) : 0), 0) }))
    : [...new Set(ways(doc).map(way => way.tags?.[key] ?? ""))].sort().map(value => ({ color: tagColor(value), label: edgeTagLabel(key, value), count: ways(doc).reduce((n, way) => n + ((way.tags?.[key] ?? "") === value ? edgeCount(way) : 0), 0) }));
  $("#sorting-legend-items").innerHTML = values.map(c => `<div class="sorting-legend-row"><i style="background:${c.color}"></i><span>${escape(c.label)}</span><small>${c.count}</small></div>`).join("");
}
function renderShortcutHints() {
  for (const shortcut of SORTING_SHORTCUTS) {
    if (!shortcut.selector) continue;
    for (const control of document.querySelectorAll(shortcut.selector)) {
      control.setAttribute("aria-keyshortcuts", shortcut.key);
      control.title = `${shortcut.label} (${shortcut.key.toUpperCase()})`;
      if (control.tagName === "BUTTON" && !control.querySelector("kbd")) {
        const hint = document.createElement("kbd");
        hint.className = "shortcut-key";
        hint.textContent = shortcut.key.toUpperCase();
        hint.setAttribute("aria-hidden", "true");
        control.append(hint);
      }
    }
  }
}
function renderGaps() {
  $("#sorting-gaps").hidden = nearMisses === null;
  if (nearMisses === null) return;
  $("#sorting-gap-count").textContent = `${nearMisses.length} possible gap${nearMisses.length === 1 ? "" : "s"}${nearMisses.length > 100 ? " · first 100 shown" : ""}`;
  $("#sorting-gap-list").innerHTML = nearMisses.slice(0, 100).map((hit, index) => `<button data-gap="${index}"><strong>Node ${hit.nodeId} → ${escape(wayName(roadById.get(hit.wayId)))}</strong><small>${hit.distance < 0.05 ? "On the line, not connected" : `${hit.distance.toFixed(1)} m from road`} · Review</small></button>`).join("");
}
function finishMove(latlng) {
  act(() => {
    const next = moveNode(doc, selectedNode, latlng.lat, latlng.lng);
    operation = null; commit(next);
    toast("Node moved in every connected path. Undo is available.");
  });
}
function finishSnap(wayId) {
  act(() => {
    const next = snapNodeToRoad(doc, selectedNode, wayId);
    selectedWay = next.id; selectedNode = next.nodeId; operation = null; commit(next.doc);
    toast("Node snapped to the road. They now share a junction. Undo is available.");
  });
}
function confirmDeletion(kind) {
  act(() => {
    const node = nodes.get(selectedNode), way = roadById.get(selectedWay);
    if ((kind === "node" && !node) || !way) return;
    const next = kind === "node" ? deleteGraphNode(doc, selectedNode) : deleteWay(doc, selectedWay);
    const removed = ways(doc).length - ways(next).length;
    $("#sorting-delete-title").textContent = kind === "node" ? `Delete node ${selectedNode}?` : `Delete ${wayName(way)}?`;
    $("#sorting-delete-description").textContent = kind === "node"
      ? `This removes the node from ${node.ways.length} connected path(s). Remaining neighboring points will connect directly.${removed ? ` ${removed} path(s) will also be deleted because fewer than two distinct nodes remain.` : ""}`
      : "This deletes the entire selected path. Other paths, including those sharing its nodes, stay intact.";
    $("#sorting-delete-confirm").textContent = kind === "node" ? "Delete node" : "Delete path";
    pendingDeletion = { before: doc, next, message: kind === "node" ? `Node deleted.${removed ? ` ${removed} path(s) also removed.` : ""} Undo is available.` : "Path deleted. Undo is available." };
    $("#sorting-delete-dialog").showModal();
  });
}
function startJunction() {
  selectedWay = selectedNode = null;
  operation = "junction";
  render();
}
function placeJunction(latlng) {
  act(() => {
    const nearby = map.containerPointToLatLng(map.latLngToContainerPoint(latlng).add([14, 0]));
    const tolerance = Math.min(25, Math.max(0.05, map.distance(latlng, nearby)));
    const next = addCrossingJunction(doc, { lat: latlng.lat, lon: latlng.lng }, tolerance);
    selectedWay = next.id; selectedNode = next.nodeId; operation = null; commit(next.doc);
    toast(`Junction added. ${next.roadIds.length} roads now share this node.`);
  });
}
function renderBanner() {
  $("#sorting-paint-panel").hidden = operation !== "color";
  $("#sorting-color-mode").setAttribute("aria-pressed", String(operation === "color"));
  $("#sorting-insert-mode").setAttribute("aria-pressed", String(operation === "insert"));
  $("#sorting-editor").hidden = !roadById.has(selectedWay) || operation === "color" || operation === "insert";
  if (renderedColorKey !== colorKey()) { renderMap(); renderList(); renderLegend(); }
  nodeLayers.eachLayer((marker) => { if (operation) marker.dragging.disable(); else marker.dragging.enable(); });
  $("#sorting-banner").hidden = !operation;
  $("#sorting-map").classList.toggle("placing", Boolean(operation));
  if (!operation) return;
  const message = { color: "Coloring: click individual edges. Choose your setting in the sidebar. K or Esc exits.", insert: "Insert node: click an edge at the new node location. I or Esc exits; K resumes coloring.", move: "Click the new location for this node. Existing junctions stay connected. Use Snap to join another road.", extend: "Click the map to extend, or click a node to join it.", connect: "Click another node to add a connecting road.", junction: "Click where roads cross. A shared node will be added to each road — no existing node needed.", branch: "Click another road where the new branch should meet it.", snap: "Click the road to snap to. The selected node moves to its nearest point and becomes a shared junction.", merge: "Click the target node to merge into its location." }[operation];
  $("#sorting-banner").innerHTML = `<span>${message}</span><button>Cancel <kbd>Esc</kbd></button>`;
}

