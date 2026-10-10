import { insertVertex, nextId, toText, ways } from "./paths.js";
import { checkSortingSnapshot, ROAD_TAG } from "./graph-sorting.js";

export const SOURCE_WAY_TAG = "stripes:source_way";
export const EDGE_FIELDS = [
  { key: ROAD_TAG, label: "Allowed road users" },
  { key: "highway", label: "Path type", values: [["steps", "Stairs"], ["footway", "Walkway"], ["path", "Path"], ["pedestrian", "Pedestrian area"], ["service", "Service road"], ["residential", "Residential road"]] },
  { key: "ramp", label: "Ramp", values: [["yes", "Ramp"], ["no", "No ramp"]] },
  { key: "surface", label: "Surface", values: [["paved", "Paved"], ["asphalt", "Asphalt"], ["concrete", "Concrete"], ["gravel", "Gravel"], ["dirt", "Dirt"], ["grass", "Grass"]] },
  { key: "custom", label: "Custom tag" },
];

function requireEdge(doc, wayId, index) {
  const way = ways(doc).find((way) => way.id === wayId);
  if (!way || !Number.isInteger(index) || index < 0 || index >= way.nodes.length - 1)
    throw new Error("Choose an existing edge between two nodes.");
  return way;
}

/** Partition only at the painted edge's endpoints, retaining ordinary OSM way/tag JSON. */
export function paintEdge(doc, wayId, index, patch) {
  const way = requireEdge(doc, wayId, index);
  if (!patch || !Object.keys(patch).length) throw new Error("Choose a setting to paint.");
  const tags = { ...way.tags };
  for (const [key, value] of Object.entries(patch)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_:.-]*$/.test(key) || [SOURCE_WAY_TAG, "constructor", "prototype"].includes(key)) throw new Error("Choose a valid, non-reserved tag name.");
    if (value !== null && typeof value !== "string") throw new Error("Tag values must be text.");
    if (value === null) delete tags[key];
    else tags[key] = value;
  }
  if (Object.keys(patch).every((key) => tags[key] === way.tags?.[key])) return { doc, id: wayId, changed: false };
  const ranges = [];
  if (index > 0) ranges.push([0, index, false]);
  ranges.push([index, index + 1, true]);
  if (index + 1 < way.nodes.length - 1) ranges.push([index + 1, way.nodes.length - 1, false]);
  let newId = nextId(doc), paintedId;
  const sections = ranges.map(([from, to, painted], part) => {
    const id = part === 0 ? way.id : newId--;
    if (painted) paintedId = id;
    return {
      ...way, id,
      nodes: way.nodes.slice(from, to + 1), geometry: way.geometry.slice(from, to + 1),
      tags: { ...(painted ? tags : way.tags), ...(ranges.length > 1 ? { [SOURCE_WAY_TAG]: way.tags?.[SOURCE_WAY_TAG] ?? String(way.id) } : {}) },
    };
  });
  const next = { ...doc, elements: doc.elements.flatMap((item) => item.id === wayId ? sections : [item]) };
  checkSortingSnapshot(toText(next));
  return { doc: next, id: paintedId, changed: true };
}

/** Project onto the exact clicked edge. Both resulting edges inherit its settings. */
export function insertEdgeNode(doc, wayId, index, point) {
  const way = requireEdge(doc, wayId, index);
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) throw new Error("Choose a valid point on the edge.");
  const a = way.geometry[index], b = way.geometry[index + 1];
  const scale = Math.cos(point.lat * Math.PI / 180), dx = (b.lon - a.lon) * scale, dy = b.lat - a.lat;
  const length = dx * dx + dy * dy;
  if (!length) throw new Error("This edge has no length. Choose another edge.");
  const t = Math.max(0, Math.min(1, ((point.lon - a.lon) * scale * dx + (point.lat - a.lat) * dy) / length));
  const position = { lat: Number((a.lat + t * dy).toFixed(7)), lon: Number((a.lon + t * (b.lon - a.lon)).toFixed(7)) };
  for (const i of [index, index + 1])
    if (Math.hypot(position.lat - way.geometry[i].lat, (position.lon - way.geometry[i].lon) * scale) * 111320 < 0.02)
      return { doc, nodeId: way.nodes[i], changed: false };
  const nodeId = nextId(doc);
  const next = insertVertex(doc, wayId, index + 1, position.lat, position.lon);
  checkSortingSnapshot(toText(next));
  return { doc: next, nodeId, changed: true };
}

const FEATURE_COLORS = { steps: "#9333ea", footway: "#16a34a", path: "#0891b2", pedestrian: "#2563eb", service: "#b45309", residential: "#dc2626", yes: "#7c3aed", no: "#64748b", paved: "#2563eb", asphalt: "#334155", concrete: "#0891b2", gravel: "#b45309", dirt: "#dc2626", grass: "#16a34a" };
export function tagColor(value) {
  if (!value) return "#9299a2";
  if (Object.hasOwn(FEATURE_COLORS, value)) return FEATURE_COLORS[value];
  let hash = 0;
  for (const char of value) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return `hsl(${(hash >>> 0) % 360} 65% 38%)`;
}
export const edgeCount = (way) => way.nodes.length - 1;
export function edgeTagLabel(key, value) {
  return EDGE_FIELDS.find((field) => field.key === key)?.values?.find(([id]) => id === value)?.[1] ?? (value || "Not set");
}
