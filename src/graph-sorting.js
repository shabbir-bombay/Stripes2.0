import { addWay, checkSnapshot, moveNode, nextId, toText, ways } from "./paths.js";

export const SORTING_STORAGE_KEY = "stripes-graph-sorting-v1";
export const ROAD_TYPES = [
  { id: "small_cart", label: "Small cart", bit: 1 },
  { id: "large_cart", label: "Large cart", bit: 2 },
  { id: "walk", label: "Walk", bit: 4 },
  { id: "car", label: "Car", bit: 8 },
];
export const ROAD_TAG = "stripes:road_types";
// Stable palette: all 15 nonempty combinations, plus unclassified gray.
const COLORS = ["#9299a2", "#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#0f766e", "#65a30d", "#b45309", "#dc2626", "#db2777", "#9333ea", "#4f46e5", "#ea580c", "#a16207", "#be185d", "#263b4b"];
export const COMBINATIONS = COLORS.map((color, mask) => ({
  mask, color,
  types: ROAD_TYPES.filter((type) => mask & type.bit).map((type) => type.id),
  label: mask ? ROAD_TYPES.filter((type) => mask & type.bit).map((type) => type.label).join(" + ") : "Unclassified",
}));
export function roadMask(way) {
  const types = (way.tags?.[ROAD_TAG] ?? "").split(";");
  return ROAD_TYPES.reduce((mask, type) => mask | (types.includes(type.id) ? type.bit : 0), 0);
}
export const roadStyle = (way) => COMBINATIONS[roadMask(way)];

export function classifyRoads(doc, ids, types) {
  if (types.some((type) => !ROAD_TYPES.some((known) => known.id === type))) throw new Error("Unknown road type.");
  const value = ROAD_TYPES.filter((type) => types.includes(type.id)).map((type) => type.id).join(";");
  return { ...doc, elements: doc.elements.map((way) => {
    if (!ids.includes(way.id)) return way;
    const tags = { ...way.tags };
    if (value) tags[ROAD_TAG] = value;
    else delete tags[ROAD_TAG];
    return { ...way, tags };
  }) };
}

export function graphNodes(doc) {
  const nodes = new Map();
  for (const way of ways(doc)) way.nodes.forEach((id, index) => {
    if (!nodes.has(id)) nodes.set(id, { id, ...way.geometry[index], ways: [], roads: [], neighbors: [] });
    const node = nodes.get(id);
    if (!node.ways.includes(way.id)) node.ways.push(way.id);
    const road = way.tags?.["stripes:source_way"] ?? String(way.id);
    if (!node.roads.includes(road)) node.roads.push(road);
    for (const neighbor of [way.nodes[index - 1], way.nodes[index + 1]])
      if (neighbor !== undefined && neighbor !== id && !node.neighbors.includes(neighbor)) node.neighbors.push(neighbor);
  });
  return nodes;
}

export const isJunction = (node) => (node.roads?.length ?? node.ways.length) > 1 || node.neighbors.length > 2;

function nearestRoadPoint(way, point) {
  const scale = Math.cos(point.lat * Math.PI / 180);
  let best = null;
  for (let index = 1; index < way.geometry.length; index++) {
    const a = way.geometry[index - 1], b = way.geometry[index];
    const dx = (b.lon - a.lon) * scale, dy = b.lat - a.lat, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.lon - a.lon) * scale * dx + (point.lat - a.lat) * dy) / length)) : 0;
    const position = { lat: Number((a.lat + t * dy).toFixed(7)), lon: Number((a.lon + t * (b.lon - a.lon)).toFixed(7)) };
    const distance = Math.hypot(position.lat - point.lat, (position.lon - point.lon) * scale) * 111320;
    if (!best || distance < best.distance) best = { index, position, distance };
  }
  return best;
}

/** Review candidates only: proximity does not imply that the roads should connect. */
export function findNearMisses(doc, maxMetres = 5) {
  if (!Number.isFinite(maxMetres) || maxMetres <= 0) throw new Error("Choose a positive search distance.");
  const candidates = [];
  for (const node of graphNodes(doc).values()) {
    let nearest = null;
    for (const way of ways(doc)) {
      if (node.ways.includes(way.id)) continue;
      const hit = nearestRoadPoint(way, node);
      if (hit.distance <= maxMetres && (!nearest || hit.distance < nearest.distance))
        nearest = { nodeId: node.id, wayId: way.id, ...hit };
    }
    if (nearest) candidates.push(nearest);
  }
  return candidates.sort((a, b) => a.distance - b.distance || a.nodeId - b.nodeId);
}

/** Move the source onto the target road and share its identity; never add a tiny connector. */
export function snapNodeToRoad(doc, sourceId, targetWayId) {
  const source = requireNode(doc, sourceId), target = ways(doc).find((way) => way.id === targetWayId);
  if (!target) throw new Error("Choose a road to snap to.");
  if (target.nodes.includes(sourceId)) throw new Error("This node is already connected to that road.");
  const { index, position, distance } = nearestRoadPoint(target, source);
  for (const i of [index - 1, index]) {
    const p = target.geometry[i];
    if (Math.hypot(p.lat - position.lat, (p.lon - position.lon) * Math.cos(position.lat * Math.PI / 180)) * 111320 > 0.5) continue;
    const nodeId = target.nodes[i];
    return { doc: mergeNodes(doc, sourceId, nodeId), nodeId, id: targetWayId, distance };
  }
  const moved = moveNode(doc, sourceId, position.lat, position.lon);
  const next = { ...moved, elements: moved.elements.map((way) => way.id === targetWayId ? {
    ...way, nodes: way.nodes.toSpliced(index, 0, sourceId), geometry: way.geometry.toSpliced(index, 0, position),
  } : way) };
  checkSortingSnapshot(toText(next));
  return { doc: next, nodeId: sourceId, id: targetWayId, distance };
}

export function checkSortingSnapshot(text) {
  const doc = checkSnapshot(text);
  const positions = new Map();
  for (const way of ways(doc)) {
    const value = way.tags?.[ROAD_TAG];
    if (value && value.split(";").some((id) => !ROAD_TYPES.some((type) => type.id === id)))
      throw new Error(`Path ${way.id} has an unknown road type.`);
    way.nodes.forEach((id, index) => {
      const p = way.geometry[index], previous = positions.get(id);
      if (previous && (previous.lat !== p.lat || previous.lon !== p.lon))
        throw new Error(`Node ${id} has conflicting coordinates. Fix it in Graphing before sorting.`);
      positions.set(id, p);
    });
  }
  return doc;
}

function requireNode(doc, id) {
  const node = graphNodes(doc).get(id);
  if (!node) throw new Error("Select an existing node.");
  return node;
}

/** Remove every occurrence, keeping the remaining vertices and their coordinates aligned. */
export function deleteGraphNode(doc, nodeId) {
  requireNode(doc, nodeId);
  return { ...doc, elements: doc.elements.flatMap((way) => {
    if (!way.nodes.includes(nodeId)) return [way];
    const nodes = [], geometry = [];
    way.nodes.forEach((id, index) => {
      if (id === nodeId || nodes.at(-1) === id) return;
      nodes.push(id); geometry.push(way.geometry[index]);
    });
    return new Set(nodes).size < 2 ? [] : [{ ...way, nodes, geometry }];
  }) };
}

export function connectNodes(doc, fromId, toId) {
  const from = requireNode(doc, fromId), to = requireNode(doc, toId);
  if (fromId === toId) throw new Error("Choose a different node to connect.");
  if (from.lat === to.lat && from.lon === to.lon) throw new Error("These nodes overlap. Merge them instead.");
  if (ways(doc).some((way) => way.nodes.some((id, i) => i > 0 &&
    ((id === fromId && way.nodes[i - 1] === toId) || (id === toId && way.nodes[i - 1] === fromId)))))
    throw new Error("These nodes are already directly connected.");
  return addWay(doc, [from, to], { highway: "path" });
}

export function extendRoad(doc, wayId, fromId, point) {
  const way = ways(doc).find((way) => way.id === wayId);
  if (!way || (way.nodes[0] !== fromId && way.nodes.at(-1) !== fromId))
    throw new Error("Select an end node of this road to extend it.");
  const from = requireNode(doc, fromId);
  const target = point.id !== undefined ? requireNode(doc, point.id) : { id: nextId(doc), lat: Number(point.lat.toFixed(7)), lon: Number(point.lon.toFixed(7)) };
  if (way.nodes.includes(target.id) || (from.lat === target.lat && from.lon === target.lon))
    throw new Error("Choose a new location or a node outside this road.");
  const atStart = way.nodes[0] === fromId;
  const geometry = { lat: target.lat, lon: target.lon };
  const result = { ...doc, elements: doc.elements.map((item) => item.id === wayId ? {
    ...way,
    nodes: atStart ? [target.id, ...way.nodes] : [...way.nodes, target.id],
    geometry: atStart ? [geometry, ...way.geometry] : [...way.geometry, geometry],
  } : item) };
  checkSortingSnapshot(toText(result));
  return { doc: result, nodeId: target.id };
}

/** Keep the target's location and identity, and rewire every use of the source. */
export function mergeNodes(doc, sourceId, targetId) {
  requireNode(doc, sourceId);
  const target = requireNode(doc, targetId);
  if (sourceId === targetId) throw new Error("Choose a different node to merge into.");
  const result = { ...doc, elements: doc.elements.map((way) => {
    if (!way.nodes.includes(sourceId)) return way;
    const nodes = [], geometry = [];
    way.nodes.forEach((id, index) => {
      const next = id === sourceId ? targetId : id;
      if (nodes.at(-1) === next) return;
      nodes.push(next);
      geometry.push(next === targetId ? { lat: target.lat, lon: target.lon } : way.geometry[index]);
    });
    if (new Set(nodes).size < 2) throw new Error("This merge would collapse a road. Choose another node.");
    return { ...way, nodes, geometry };
  }) };
  checkSortingSnapshot(toText(result));
  return result;
}

/** Split the clicked road at the closest point and attach the selected node there. */
export function addJunction(doc, sourceId, targetWayId, point) {
  const source = requireNode(doc, sourceId);
  const target = ways(doc).find((way) => way.id === targetWayId);
  if (!target) throw new Error("Choose a road for the junction.");
  if (target.nodes.includes(sourceId)) throw new Error("This node already belongs to that road. Choose another road.");
  const scale = Math.cos(point.lat * Math.PI / 180);
  const distance = (a, b) => Math.hypot(a.lat - b.lat, (a.lon - b.lon) * scale) * 111320;
  let best = null;
  for (let index = 1; index < target.geometry.length; index++) {
    const a = target.geometry[index - 1], b = target.geometry[index];
    const dx = (b.lon - a.lon) * scale, dy = b.lat - a.lat;
    const denominator = dx * dx + dy * dy;
    const t = denominator ? Math.max(0, Math.min(1, (((point.lon - a.lon) * scale) * dx + (point.lat - a.lat) * dy) / denominator)) : 0;
    const projected = { lat: Number((a.lat + t * dy).toFixed(7)), lon: Number((a.lon + t * (b.lon - a.lon)).toFixed(7)) };
    const gap = distance(point, projected);
    if (!best || gap < best.gap) best = { index, projected, gap };
  }
  const { index, projected } = best;
  // Reuse nearby vertices so a click near an endpoint doesn't make tiny duplicate edges.
  for (const i of [index - 1, index]) {
    if (distance(projected, target.geometry[i]) > 0.5) continue;
    const nodeId = target.nodes[i];
    if (distance(source, target.geometry[i]) <= 0.5)
      return { doc: mergeNodes(doc, sourceId, nodeId), nodeId, id: targetWayId };
    return { ...connectNodes(doc, sourceId, nodeId), nodeId };
  }
  const reuseSource = distance(source, projected) <= 0.5;
  const nodeId = reuseSource ? sourceId : nextId(doc);
  const base = reuseSource ? moveNode(doc, sourceId, projected.lat, projected.lon) : doc;
  const split = { ...base, elements: base.elements.map((way) => way.id === targetWayId ? {
    ...way, nodes: way.nodes.toSpliced(index, 0, nodeId), geometry: way.geometry.toSpliced(index, 0, projected),
  } : way) };
  if (reuseSource) return { doc: split, nodeId, id: targetWayId };
  return { ...connectNodes(split, sourceId, nodeId), nodeId };
}

/** Join roads at the actual crossing nearest a click, even without existing vertices. */
export function addCrossingJunction(doc, point, toleranceMetres = 5) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon) || !Number.isFinite(toleranceMetres) || toleranceMetres <= 0)
    throw new Error("Choose a valid location for the junction.");
  const scale = Math.cos(point.lat * Math.PI / 180) * 111320;
  const xy = (p) => ({ x: (p.lon - point.lon) * scale, y: (p.lat - point.lat) * 111320 });
  const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const closest = (p, a, b) => {
    const d = subtract(b, a), length = d.x * d.x + d.y * d.y;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / length)) : 0;
    return { x: a.x + t * d.x, y: a.y + t * d.y };
  };
  const origin = { x: 0, y: 0 }, epsilon = 0.02; // Covers seven-decimal coordinate rounding.
  const segments = [];
  for (const way of ways(doc)) for (let index = 1; index < way.nodes.length; index++) {
    const a = xy(way.geometry[index - 1]), b = xy(way.geometry[index]);
    if (distance(a, b) < 1e-8 || distance(origin, closest(origin, a, b)) > toleranceMetres) continue;
    segments.push({ way, index, a, b });
  }
  let crossing = null, bestDistance = Infinity;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const first = segments[i], second = segments[j];
    if (first.way.id === second.way.id) continue;
    const r = subtract(first.b, first.a), s = subtract(second.b, second.a), offset = subtract(second.a, first.a);
    const denominator = cross(r, s);
    let at;
    if (Math.abs(denominator) < 1e-10) {
      // Collinear overlap: use the closest point in the common part, not a distant endpoint.
      if (Math.abs(cross(offset, r)) / Math.hypot(r.x, r.y) > 1e-6) continue;
      const overlap = [first.a, first.b, second.a, second.b].filter((p) =>
        distance(p, closest(p, first.a, first.b)) < 1e-6 && distance(p, closest(p, second.a, second.b)) < 1e-6);
      if (!overlap.length) continue;
      overlap.sort((a, b) => a.x - b.x || a.y - b.y);
      at = closest(origin, overlap[0], overlap.at(-1));
    } else {
      const t = cross(offset, s) / denominator, u = cross(offset, r) / denominator;
      if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) continue;
      at = { x: first.a.x + t * r.x, y: first.a.y + t * r.y };
    }
    const gap = distance(origin, at);
    if (gap <= toleranceMetres && gap < bestDistance) { crossing = at; bestDistance = gap; }
  }
  if (!crossing) throw new Error("No crossing here. Click where two roads meet, or use Branch to road to connect separate roads.");
  const position = { lat: Number((point.lat + crossing.y / 111320).toFixed(7)), lon: Number((point.lon + crossing.x / scale).toFixed(7)) };
  const hits = segments.filter((segment) => distance(crossing, closest(crossing, segment.a, segment.b)) <= epsilon);
  const roadIds = [...new Set(hits.map((hit) => hit.way.id))];
  const existing = new Set();
  for (const hit of hits) for (const index of [hit.index - 1, hit.index])
    if (distance(xy(hit.way.geometry[index]), crossing) <= epsilon) existing.add(hit.way.nodes[index]);
  const nodeId = existing.size ? [...existing][0] : nextId(doc);
  const insertions = new Map();
  for (const hit of hits) {
    if (existing.has(hit.way.nodes[hit.index - 1]) || existing.has(hit.way.nodes[hit.index])) continue;
    if (!insertions.has(hit.way.id)) insertions.set(hit.way.id, new Set());
    insertions.get(hit.way.id).add(hit.index);
  }
  if (existing.size === 1 && !insertions.size) throw new Error("These roads already share a junction here.");
  const next = { ...doc, elements: doc.elements.map((way) => {
    if (!insertions.has(way.id) && !way.nodes.some((id) => existing.has(id))) return way;
    const nodes = [], geometry = [];
    const append = (id, p) => { if (nodes.at(-1) !== id) { nodes.push(id); geometry.push(p); } };
    way.nodes.forEach((id, index) => {
      if (insertions.get(way.id)?.has(index)) append(nodeId, position);
      append(existing.has(id) ? nodeId : id, existing.has(id) ? position : way.geometry[index]);
    });
    if (new Set(nodes).size < 2) throw new Error("This junction would collapse a road. Zoom in and choose another crossing.");
    return { ...way, nodes, geometry };
  }) };
  checkSortingSnapshot(toText(next));
  return { doc: next, nodeId, roadIds, id: roadIds[0] };
}
