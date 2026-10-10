import test from "node:test";
import assert from "node:assert/strict";
import { deleteWay, moveNode, toText } from "./paths.js";
import { COMBINATIONS, ROAD_TAG, addCrossingJunction, addJunction, checkSortingSnapshot, classifyRoads, connectNodes, deleteGraphNode, extendRoad, findNearMisses, graphNodes, isJunction, mergeNodes, roadMask, snapNodeToRoad } from "./graph-sorting.js";

const p = (lat, lon) => ({ lat, lon });
const doc = { version: 0.6, elements: [
  { type: "way", id: 10, nodes: [1, 2, 3], geometry: [p(37, -121), p(37.001, -121), p(37.002, -121)], tags: { highway: "footway", name: "Walkway", surface: "paved" } },
  { type: "way", id: 11, nodes: [3, 4], geometry: [p(37.002, -121), p(37.003, -121.001)], tags: { highway: "service" } },
  { type: "way", id: 12, nodes: [5, 6], geometry: [p(37.004, -121.002), p(37.004, -121)], tags: { highway: "residential" } },
] };

test("deleting an interior node reconnects neighbors with tags and coordinates preserved", () => {
  const original = classifyRoads(doc, [10], ["walk"]), before = toText(original);
  const next = deleteGraphNode(original, 2);
  assert.deepEqual(next.elements[0].nodes, [1, 3]);
  assert.deepEqual(next.elements[0].geometry, [original.elements[0].geometry[0], original.elements[0].geometry[2]]);
  assert.deepEqual(next.elements[0].tags, original.elements[0].tags);
  assert.equal(next.elements[1], original.elements[1]);
  assert.equal(toText(original), before, "undo source remains unchanged");
  checkSortingSnapshot(toText(next));
});

test("deleting a shared node removes all uses and paths too short to survive", () => {
  const next = deleteGraphNode(doc, 3);
  assert.deepEqual(next.elements.map((way) => way.id), [10, 12]);
  assert.deepEqual(next.elements[0].nodes, [1, 2]);
  assert.equal(graphNodes(next).has(3), false);
  assert.throws(() => deleteGraphNode(doc, 999), /existing node/);
  checkSortingSnapshot(toText(next));
});

test("node deletion handles repeated loop vertices and allows an empty graph", () => {
  const loop = { elements: [{ ...doc.elements[0], nodes: [1, 2, 1, 3, 1], geometry: [doc.elements[0].geometry[0], doc.elements[0].geometry[1], doc.elements[0].geometry[0], doc.elements[0].geometry[2], doc.elements[0].geometry[0]] }] };
  assert.deepEqual(deleteGraphNode(loop, 1).elements[0].nodes, [2, 3]);
  const empty = deleteGraphNode({ elements: [doc.elements[1]] }, 3);
  assert.deepEqual(empty.elements, []);
  checkSortingSnapshot(toText(empty));
});

test("deleting a path preserves other roads using its junction nodes", () => {
  const next = deleteWay(doc, 10);
  assert.deepEqual(next.elements.map((way) => way.id), [11, 12]);
  assert.equal(next.elements[0], doc.elements[1]);
  assert.deepEqual(graphNodes(next).get(3).ways, [11]);
  assert.equal(doc.elements.length, 3);
  checkSortingSnapshot(toText(next));
});

test("all 16 combinations have unique stable colors and round-trip without altering OSM tags or graphing", () => {
  assert.equal(new Set(COMBINATIONS.map((c) => c.color)).size, 16);
  const original = toText(doc);
  for (const combination of COMBINATIONS) {
    const next = classifyRoads(doc, [10], combination.types.toReversed());
    assert.equal(roadMask(next.elements[0]), combination.mask);
    assert.equal(next.elements[0].tags.surface, "paved");
    assert.deepEqual(next.elements[0].nodes, doc.elements[0].nodes);
    assert.equal(roadMask(next.elements[1]), 0);
    assert.equal(roadMask(checkSortingSnapshot(toText(next)).elements[0]), combination.mask);
  }
  assert.equal(toText(doc), original);
  const cleared = classifyRoads(classifyRoads(doc, [10], ["car", "walk"]), [10], []);
  assert.deepEqual(cleared, doc);
  assert.throws(() => classifyRoads(doc, [10], ["bus"]), /Unknown road type/);
});

test("node membership exposes all incident roads without merging their classifications", () => {
  const next = classifyRoads(doc, [10], ["walk"]);
  assert.deepEqual(graphNodes(next).get(3).ways, [10, 11]);
  assert.equal(roadMask(next.elements[0]), 4);
  assert.equal(roadMask(next.elements[1]), 0);
});

test("connect creates an unclassified road with existing node identities and rejects duplicate edges", () => {
  const next = connectNodes(doc, 4, 5);
  assert.deepEqual(next.doc.elements.at(-1).nodes, [4, 5]);
  assert.deepEqual(next.doc.elements.at(-1).geometry, [p(37.003, -121.001), p(37.004, -121.002)]);
  assert.equal(roadMask(next.doc.elements.at(-1)), 0);
  assert.equal(graphNodes(next.doc).get(4).ways.length, 2);
  checkSortingSnapshot(toText(next.doc));
  assert.throws(() => connectNodes(doc, 1, 2), /already directly/);
  assert.throws(() => connectNodes(doc, 2, 1), /already directly/);
  assert.throws(() => connectNodes(doc, 2, 2), /different node/);
  assert.throws(() => connectNodes(doc, 999, 2), /existing node/);
});

test("extensions work at either endpoint, retain road classification, and reuse target nodes", () => {
  const classified = classifyRoads(doc, [10], ["small_cart", "walk"]);
  const before = extendRoad(classified, 10, 1, p(36.999, -121));
  assert.deepEqual(before.doc.elements[0].nodes, [before.nodeId, 1, 2, 3]);
  assert.equal(roadMask(before.doc.elements[0]), 5);
  const after = extendRoad(classified, 10, 3, { id: 5 });
  assert.deepEqual(after.doc.elements[0].nodes, [1, 2, 3, 5]);
  assert.deepEqual(after.doc.elements[0].geometry.at(-1), doc.elements[2].geometry[0]);
  assert.throws(() => extendRoad(doc, 10, 2, p(37, -120)), /end node/);
  assert.throws(() => extendRoad(doc, 10, 3, { id: 1 }), /outside this road/);
  checkSortingSnapshot(toText(after.doc));
});

test("merging rewires every source use to the target, preserves tags, and keeps coordinates aligned", () => {
  const classified = classifyRoads(doc, [10], ["car"]);
  const next = mergeNodes(classified, 3, 5);
  assert.deepEqual(next.elements[0].nodes, [1, 2, 5]);
  assert.deepEqual(next.elements[1].nodes, [5, 4]);
  assert.deepEqual(next.elements[0].geometry[2], p(37.004, -121.002));
  assert.deepEqual(next.elements[1].geometry[0], p(37.004, -121.002));
  assert.equal(graphNodes(next).get(5).ways.length, 3);
  assert.equal(roadMask(next.elements[0]), 8);
  assert.equal(graphNodes(next).has(3), false);
  assert.deepEqual(doc.elements[0].nodes, [1, 2, 3]);
  checkSortingSnapshot(toText(next));
});

test("merging removes consecutive duplicates but rejects road collapse atomically", () => {
  const next = mergeNodes(doc, 2, 1);
  assert.deepEqual(next.elements[0].nodes, [1, 3]);
  assert.equal(next.elements[0].nodes.length, next.elements[0].geometry.length);
  assert.throws(() => mergeNodes(doc, 4, 3), /collapse a road/);
  assert.deepEqual(doc.elements[1].nodes, [3, 4]);
});

test("a T-junction inserts a shared node into the target road and connects the source to it", () => {
  const classified = classifyRoads(doc, [12], ["car", "large_cart"]);
  const next = addJunction(classified, 4, 12, p(37.0041, -121.001));
  const target = next.doc.elements.find((way) => way.id === 12);
  const connector = next.doc.elements.find((way) => way.id === next.id);
  assert.deepEqual(target.nodes, [5, next.nodeId, 6]);
  assert.deepEqual(target.geometry[1], p(37.004, -121.001));
  assert.deepEqual(connector.nodes, [4, next.nodeId]);
  assert.deepEqual(connector.geometry[1], target.geometry[1]);
  assert.equal(roadMask(target), 10);
  assert.equal(roadMask(connector), 0);
  assert.deepEqual(graphNodes(next.doc).get(next.nodeId).ways, [12, next.id]);
  assert.deepEqual(doc.elements[2].nodes, [5, 6]);
  checkSortingSnapshot(toText(next.doc));
});

test("junction near an existing endpoint reuses it; a source on the road becomes the junction itself", () => {
  const endpoint = addJunction(doc, 4, 12, p(37.004, -121.002));
  assert.equal(endpoint.nodeId, 5);
  assert.deepEqual(endpoint.doc.elements[2].nodes, [5, 6]);
  const overlapping = structuredClone(doc);
  overlapping.elements[1].geometry[1] = p(37.004, -121.001);
  const shared = addJunction(overlapping, 4, 12, p(37.004, -121.001));
  assert.equal(shared.nodeId, 4);
  assert.equal(shared.doc.elements.length, 3, "no zero-length connector");
  assert.deepEqual(shared.doc.elements[2].nodes, [5, 4, 6]);
  checkSortingSnapshot(toText(shared.doc));
  assert.throws(() => addJunction(doc, 3, 10, p(37.001, -121)), /already belongs/);
});

test("sorting imports reject conflicting node coordinates and unknown classifications", () => {
  const badPosition = structuredClone(doc);
  badPosition.elements[1].geometry[0].lat = 38;
  assert.throws(() => checkSortingSnapshot(toText(badPosition)), /conflicting coordinates/);
  const badTypes = structuredClone(doc);
  badTypes.elements[0].tags[ROAD_TAG] = "bus";
  assert.throws(() => checkSortingSnapshot(toText(badTypes)), /unknown road type/);
});

const crossingGraph = () => ({ elements: [
  { type: "way", id: 20, nodes: [1, 2], geometry: [p(37.98, -121.314), p(37.98, -121.310)], tags: { highway: "service", [ROAD_TAG]: "small_cart;walk" } },
  { type: "way", id: 21, nodes: [3, 4], geometry: [p(37.978, -121.312), p(37.982, -121.312)], tags: { highway: "footway", [ROAD_TAG]: "walk" } },
] });

test("clicking a crossing without any node inserts one shared node into both roads", () => {
  const original = crossingGraph(), before = toText(original);
  const next = addCrossingJunction(original, p(37.98001, -121.31199), 5);
  assert.equal(next.doc.elements.length, 2, "no extra connecting road or detour");
  assert.deepEqual(next.doc.elements[0].nodes, [1, next.nodeId, 2]);
  assert.deepEqual(next.doc.elements[1].nodes, [3, next.nodeId, 4]);
  assert.deepEqual(next.doc.elements[0].geometry[1], p(37.98, -121.312));
  assert.deepEqual(next.doc.elements[1].geometry[1], p(37.98, -121.312));
  assert.deepEqual(next.doc.elements.map((w) => w.tags), original.elements.map((w) => w.tags));
  assert.deepEqual(graphNodes(next.doc).get(next.nodeId).ways, [20, 21]);
  assert.equal(toText(original), before, "graphing and undo source unchanged");
  checkSortingSnapshot(toText(next.doc));
  assert.throws(() => addCrossingJunction(next.doc, p(37.98, -121.312)), /already share/);
});

test("crossing reuses a T-junction endpoint and inserts it into the other road", () => {
  const graph = crossingGraph();
  graph.elements[1].geometry[0] = p(37.98, -121.312);
  const next = addCrossingJunction(graph, p(37.98, -121.312));
  assert.equal(next.nodeId, 3);
  assert.deepEqual(next.doc.elements[0].nodes, [1, 3, 2]);
  assert.deepEqual(next.doc.elements[1].nodes, [3, 4]);
});

test("overlapping existing vertices are unified and rewired in every road", () => {
  const graph = crossingGraph();
  graph.elements[0].nodes.splice(1, 0, 5);
  graph.elements[0].geometry.splice(1, 0, p(37.98, -121.312));
  graph.elements[1].nodes.splice(1, 0, 6);
  graph.elements[1].geometry.splice(1, 0, p(37.98, -121.312));
  graph.elements.push({ type: "way", id: 22, nodes: [6, 7], geometry: [p(37.98, -121.312), p(37.981, -121.311)], tags: { highway: "path" } });
  const next = addCrossingJunction(graph, p(37.98, -121.312));
  assert.equal(graphNodes(next.doc).get(next.nodeId).ways.length, 3);
  assert.equal(graphNodes(next.doc).has(next.nodeId === 5 ? 6 : 5), false);
  checkSortingSnapshot(toText(next.doc));
});

test("a crossing joins all roads at that location, excluding nearby parallel roads", () => {
  const graph = crossingGraph();
  graph.elements.push({ type: "way", id: 22, nodes: [5, 6], geometry: [p(37.979, -121.313), p(37.981, -121.311)], tags: { highway: "path" } });
  graph.elements.push({ type: "way", id: 23, nodes: [7, 8], geometry: [p(37.98004, -121.314), p(37.98004, -121.310)], tags: { highway: "path" } });
  const next = addCrossingJunction(graph, p(37.98, -121.312));
  assert.deepEqual(next.roadIds, [20, 21, 22]);
  assert.equal(next.doc.elements[3], graph.elements[3]);
  checkSortingSnapshot(toText(next.doc));
});

test("junction clicks must be near an actual crossing, not just nearby roads", () => {
  assert.throws(() => addCrossingJunction(crossingGraph(), p(37.981, -121.312)), /No crossing/);
  const parallel = crossingGraph();
  parallel.elements[1].geometry = [p(37.98001, -121.314), p(37.98001, -121.310)];
  assert.throws(() => addCrossingJunction(parallel, p(37.98, -121.312)), /No crossing/);
  assert.throws(() => addCrossingJunction(crossingGraph(), p(NaN, 0)), /valid location/);
});

test("collinear overlapping roads can share a junction at the clicked point", () => {
  const graph = crossingGraph();
  graph.elements[1].geometry = [p(37.98, -121.313), p(37.98, -121.309)];
  const next = addCrossingJunction(graph, p(37.98, -121.312));
  assert.deepEqual(next.doc.elements[0].geometry[1], p(37.98, -121.312));
  assert.deepEqual(next.doc.elements[1].geometry[1], p(37.98, -121.312));
  checkSortingSnapshot(toText(next.doc));
});

test("snapping a near-miss endpoint moves it onto the road and creates a shared junction without another path", () => {
  const graph = crossingGraph();
  graph.elements[1].geometry[0] = p(37.98002, -121.312);
  const before = toText(graph), next = snapNodeToRoad(graph, 3, 20);
  assert.equal(next.nodeId, 3);
  assert.deepEqual(next.doc.elements[0].nodes, [1, 3, 2]);
  assert.deepEqual(next.doc.elements[1].geometry[0], p(37.98, -121.312));
  assert.equal(next.doc.elements.length, 2);
  assert.ok(isJunction(graphNodes(next.doc).get(3)));
  assert.equal(toText(graph), before);
  assert.deepEqual(next.doc.elements.map(w => w.tags), graph.elements.map(w => w.tags));
  checkSortingSnapshot(toText(next.doc));
});

test("snapping a node exactly on an unconnected line changes connectivity without changing its location", () => {
  const graph = crossingGraph();
  graph.elements[1].geometry[0] = p(37.98, -121.312);
  const next = snapNodeToRoad(graph, 3, 20);
  assert.equal(next.distance, 0);
  assert.deepEqual(graphNodes(next.doc).get(3).ways, [20, 21]);
  assert.throws(() => snapNodeToRoad(next.doc, 3, 20), /already connected/);
});

test("snapping near a road vertex reuses it and rewires every source reference", () => {
  const graph = crossingGraph();
  graph.elements[1].geometry[0] = p(37.98001, -121.314);
  const next = snapNodeToRoad(graph, 3, 20);
  assert.equal(next.nodeId, 1);
  assert.deepEqual(next.doc.elements[0].nodes, [1, 2]);
  assert.deepEqual(next.doc.elements[1].nodes, [1, 4]);
  assert.equal(graphNodes(next.doc).has(3), false);
  checkSortingSnapshot(toText(next.doc));
});

test("gap review finds near misses and on-line nodes, excludes connected roads and respects distance", () => {
  const graph = crossingGraph();
  graph.elements[1].geometry[0] = p(37.98002, -121.312);
  assert.equal(findNearMisses(graph, 1).length, 0);
  const candidates = findNearMisses(graph, 3);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].nodeId, 3);
  assert.equal(candidates[0].wayId, 20);
  assert.ok(candidates[0].distance > 2 && candidates[0].distance < 3);
  assert.equal(findNearMisses(snapNodeToRoad(graph, 3, 20).doc, 3).length, 0);
  graph.elements[1].geometry[0] = p(37.98, -121.312);
  assert.equal(findNearMisses(graph, 1)[0].distance, 0);
});

test("moving a classified junction moves all road occurrences, retaining identity and classification", () => {
  const joined = snapNodeToRoad(crossingGraph(), 3, 20).doc;
  const moved = moveNode(joined, 3, 37.9801, -121.3121);
  for (const way of moved.elements) {
    assert.deepEqual(way.geometry[way.nodes.indexOf(3)], p(37.9801, -121.3121));
    assert.deepEqual(way.tags, joined.elements.find(w => w.id === way.id).tags);
  }
  assert.ok(isJunction(graphNodes(moved).get(3)));
  assert.equal(isJunction(graphNodes(moved).get(1)), false);
  assert.notDeepEqual(joined.elements[0].geometry[1], moved.elements[0].geometry[1]);
  checkSortingSnapshot(toText(moved));
});
