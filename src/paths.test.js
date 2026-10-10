import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPUS_BBOX, addWay, corners, fromCorner, insertVertex, checkSnapshot, deleteWay, formatTags, moveNode, nextId, overpassQuery, parseTags, removeVertex, toText } from './paths.js';

const g = (lat, lon) => ({ lat, lon });
const doc = { version: 0.6, elements: [
  { type: 'way', id: 10, nodes: [1, 2, 3], geometry: [g(37, -121), g(37.001, -121), g(37.002, -121)], tags: { highway: 'footway' } },
  { type: 'way', id: 11, nodes: [3, 4], geometry: [g(37.002, -121), g(37.003, -121.001)], tags: { highway: 'service' } },
] };

test('moving a junction moves it in every way that shares the node', () => {
  const next = moveNode(doc, 3, 37.5, -121.5);
  assert.deepEqual(next.elements[0].geometry[2], g(37.5, -121.5));
  assert.deepEqual(next.elements[1].geometry[0], g(37.5, -121.5));
  assert.deepEqual(doc.elements[0].geometry[2], g(37.002, -121), 'original untouched for undo');
});
test('new paths get fresh negative ids and can join existing nodes', () => {
  assert.equal(nextId(doc), -1);
  const { doc: next, id } = addWay(doc, [{ id: 1, lat: 37, lon: -121 }, g(37.1, -121.1)]);
  assert.equal(id, -1);
  assert.deepEqual(next.elements.at(-1).nodes, [1, -2]);
  assert.equal(nextId(next), -3);
  checkSnapshot(toText(next));
});
test('removing points keeps nodes and geometry aligned, and drops a path left with one point', () => {
  const next = removeVertex(doc, 10, 1);
  assert.deepEqual(next.elements[0].nodes, [1, 3]);
  assert.equal(next.elements[0].geometry.length, 2);
  assert.equal(removeVertex(doc, 11, 0).elements.length, 1);
  assert.equal(deleteWay(doc, 10).elements.length, 1);
});
test('tags round-trip through the text editor and reject lines without a key', () => {
  assert.deepEqual(parseTags(formatTags({ highway: 'footway', name: 'A=B walk' })), { highway: 'footway', name: 'A=B walk' });
  assert.throws(() => parseTags('=oops'));
});
test('invalid snapshots are rejected', () => {
  assert.equal(checkSnapshot(toText(doc)).elements.length, 2);
  const bad = (change) => { const copy = structuredClone(doc); change(copy.elements[0]); return toText(copy); };
  for (const text of ['nope', '{}', bad((w) => { w.geometry.pop(); }), bad((w) => { w.id = 11; }), bad((w) => { w.geometry[0].lat = 95; }), bad((w) => { w.tags.x = 1; }), bad((w) => { w.nodes = [1]; w.geometry = [g(1, 1)]; })])
    assert.throws(() => checkSnapshot(text));
});
test('the default query is the app fetch script query; a drawn area is rounded into the same query', () => {
  assert.equal(overpassQuery(), '[out:json][timeout:60];way["highway"](37.9745,-121.3185,37.9845,-121.3035);out body geom;');
  assert.equal(overpassQuery({ ...CAMPUS_BBOX, south: 37.97451234567 }), overpassQuery({ ...CAMPUS_BBOX, south: 37.974512 }));
  assert.match(overpassQuery({ south: 1, west: 2, north: 3, east: 4 }), /\(1,2,3,4\)/);
});
test('image placement: corners follow rotation, and dragging a corner recovers rotation and width', () => {
  const place = { center: { lat: 37.98, lng: -121.31 }, width: 400, aspect: 1.3, rotation: 0 };
  const [tl, tr, bl] = corners(place);
  assert.ok(tl[0] > bl[0] && tr[1] > tl[1], 'unrotated: top is north, right is east');
  for (const rotation of [0, 17.5, -40, 179]) {
    const [, corner] = corners({ ...place, rotation });
    const back = fromCorner(place, { lat: corner[0], lng: corner[1] });
    assert.ok(Math.abs(back.rotation - rotation) < 1e-6, `rotation ${rotation} -> ${back.rotation}`);
    assert.ok(Math.abs(back.width - 400) < 1e-6);
  }
  const [, turned] = corners({ ...place, rotation: 90 });
  assert.ok(turned[1] > place.center.lng && turned[0] < place.center.lat, 'a clockwise quarter turn puts the top-right corner in the south-east');
});
test('a point added between two points gets a new id, keeps nodes and geometry aligned, and leaves other paths alone', () => {
  const next = insertVertex(doc, 10, 1, 37.0005, -121.0002);
  assert.deepEqual(next.elements[0].nodes, [1, -1, 2, 3]);
  assert.deepEqual(next.elements[0].geometry[1], g(37.0005, -121.0002));
  assert.equal(next.elements[1], doc.elements[1]);
  assert.equal(doc.elements[0].nodes.length, 3, 'original untouched for undo');
  checkSnapshot(toText(next));
});
