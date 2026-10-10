// Path Studio data: an Overpass `out body geom` snapshot. Every way keeps `nodes` and `geometry`
// index-aligned; shared node ids are how junctions are found, so a moved node moves in every way.

// University of the Pacific, Stockton campus.
export const CAMPUS_BBOX = { south: 37.9745, north: 37.9845, west: -121.3185, east: -121.3035 };
// The main server often answers 504 when busy; the mirror is the fallback.
export const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
export const overpassQuery = (bbox = CAMPUS_BBOX) => {
  const [south, west, north, east] = ["south", "west", "north", "east"].map((key) => Number(Number(bbox[key]).toFixed(6)));
  return `[out:json][timeout:60];way["highway"](${south},${west},${north},${east});out body geom;`;
};
export const MAX_SNAPSHOT_BYTES = 1024 * 1024;

export const toText = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
export const ways = (doc) => doc.elements.filter((element) => element.type === "way");
export const wayName = (way) =>
  way.tags?.name || `${way.tags?.highway ?? "path"} ${way.id < 0 ? "(new)" : way.id}`;

/** Throws with a readable message unless `text` is a valid snapshot. */
export function checkSnapshot(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_SNAPSHOT_BYTES)
    throw new Error("Map files must be smaller than 1 MB.");
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("The map file is not valid JSON.");
  }
  if (!Array.isArray(doc?.elements) || doc.elements.length > 20000)
    throw new Error("The map file needs an elements list of at most 20,000 paths.");
  const ids = new Set();
  for (const way of doc.elements) {
    const where = `Path ${way?.id ?? "?"}`;
    if (way?.type !== "way" || !Number.isSafeInteger(way.id) || ids.has(way.id))
      throw new Error(`${where} needs type "way" and a unique whole-number id.`);
    ids.add(way.id);
    if (!Array.isArray(way.nodes) || way.nodes.length < 2 || !way.nodes.every(Number.isSafeInteger))
      throw new Error(`${where} needs at least two node ids.`);
    if (!Array.isArray(way.geometry) || way.geometry.length !== way.nodes.length)
      throw new Error(`${where} needs one coordinate per node.`);
    for (const p of way.geometry)
      if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180)
        throw new Error(`${where} has an invalid coordinate.`);
    if (way.tags !== undefined && (typeof way.tags !== "object" || Array.isArray(way.tags) || !Object.values(way.tags).every((v) => typeof v === "string")))
      throw new Error(`${where} has invalid tags.`);
  }
  return doc;
}

const replaceWays = (doc, change) => ({ ...doc, elements: doc.elements.map(change).filter(Boolean) });
const round = (value) => Number(value.toFixed(7)); // OSM's own precision.

export function moveNode(doc, nodeId, lat, lon) {
  return replaceWays(doc, (way) =>
    way.nodes.includes(nodeId)
      ? { ...way, geometry: way.geometry.map((p, i) => (way.nodes[i] === nodeId ? { lat: round(lat), lon: round(lon) } : p)) }
      : way,
  );
}

export const setTags = (doc, wayId, tags) =>
  replaceWays(doc, (way) => (way.id === wayId ? { ...way, tags } : way));

export const deleteWay = (doc, wayId) => replaceWays(doc, (way) => (way.id === wayId ? null : way));

/** Drops one point from a way; a way left with fewer than two points is removed. */
export const removeVertex = (doc, wayId, index) =>
  replaceWays(doc, (way) => {
    if (way.id !== wayId) return way;
    if (way.nodes.length <= 2) return null;
    return { ...way, nodes: way.nodes.filter((_, i) => i !== index), geometry: way.geometry.filter((_, i) => i !== index) };
  });

/** Adds a new point to a way before `index` (so between points index-1 and index). */
export function insertVertex(doc, wayId, index, lat, lon) {
  const id = nextId(doc);
  return replaceWays(doc, (way) =>
    way.id === wayId
      ? { ...way, nodes: way.nodes.toSpliced(index, 0, id), geometry: way.geometry.toSpliced(index, 0, { lat: round(lat), lon: round(lon) }) }
      : way,
  );
}

/** New ids are negative, as in OSM editors, so they never collide with a real OSM id. */
export function nextId(doc) {
  let min = 0;
  for (const way of ways(doc)) min = Math.min(min, way.id, ...way.nodes);
  return min - 1;
}

/** `points` are `{ lat, lon, id? }`; a point with an id joins that existing node (a junction). */
export function addWay(doc, points, tags = { highway: "footway" }) {
  let id = nextId(doc);
  const wayId = id--;
  const nodes = points.map((p) => p.id ?? id--);
  const geometry = points.map((p) => ({ lat: round(p.lat), lon: round(p.lon) }));
  return { doc: { ...doc, elements: [...doc.elements, { type: "way", id: wayId, nodes, geometry, tags }] }, id: wayId };
}

export function parseTags(text) {
  const tags = {};
  for (const [index, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.indexOf("=");
    if (at < 1) throw new Error(`Line ${index + 1} needs key=value.`);
    tags[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return tags;
}
export const formatTags = (tags = {}) =>
  Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

// ---- Reference image placement (Path Studio's campus image) ----

const METRES_PER_DEGREE = 111320;

/** Corners in the order the rotated overlay wants: top-left, top-right, bottom-left. */
export function corners({ center, width, aspect, rotation }) {
  const h = width * aspect, theta = (rotation * Math.PI) / 180;
  const at = (x, y) => {
    const east = x * Math.cos(theta) + y * Math.sin(theta);
    const north = -x * Math.sin(theta) + y * Math.cos(theta);
    return [center.lat + north / METRES_PER_DEGREE, center.lng + east / (METRES_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180))];
  };
  return [at(-width / 2, h / 2), at(width / 2, h / 2), at(-width / 2, -h / 2)];
}

/** Rotation and width that put the top-right corner at `point`, keeping the centre fixed. */
export function fromCorner({ center, aspect }, point) {
  const east = (point.lng - center.lng) * METRES_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180);
  const north = (point.lat - center.lat) * METRES_PER_DEGREE;
  const cornerAngle = Math.atan2(aspect, 1); // the corner's angle when unrotated
  return {
    width: (2 * Math.hypot(east, north)) / Math.hypot(1, aspect),
    rotation: (((cornerAngle - Math.atan2(north, east)) * 180) / Math.PI + 540) % 360 - 180,
  };
}
