import test from 'node:test';
import assert from 'node:assert/strict';
import { paintEdge, insertEdgeNode, SOURCE_WAY_TAG } from './edge-editing.js';
import { ROAD_TAG, checkSortingSnapshot, graphNodes, isJunction } from './graph-sorting.js';
import { moveNode, toText } from './paths.js';

const doc = { elements: [
  { type: 'way', id: 10, nodes: [1, 2, 3, 4], geometry: [0, 1, 2, 3].map(i => ({lat: 37 + i * .001, lon: -121})), tags: { highway: 'footway', surface: 'paved', [ROAD_TAG]: 'walk' } },
  { type: 'way', id: 11, nodes: [4, 5], geometry: [{lat: 37.003, lon: -121}, {lat: 37.003, lon: -120.999}], tags: {highway: 'service'} },
] };

test('painting an interior edge preserves topology, adjacent settings, and undo source', () => {
  const before = toText(doc), {doc: next, id} = paintEdge(doc, 10, 1, {highway: 'steps'});
  assert.deepEqual(next.elements.map(w => w.nodes), [[1,2], [2,3], [3,4], [4,5]]);
  assert.deepEqual(next.elements.map(w => w.tags.highway), ['footway','steps','footway','service']);
  assert.equal(next.elements.find(w => w.id === id).tags[ROAD_TAG], 'walk');
  assert.equal(next.elements.find(w => w.id === id).tags.surface, 'paved');
  assert.equal(next.elements[3], doc.elements[1]);
  assert.equal(toText(doc), before);
  assert.deepEqual(checkSortingSnapshot(toText(next)), next);
  for (const node of graphNodes(doc).values()) {
    assert.deepEqual(graphNodes(next).get(node.id).neighbors, node.neighbors);
    assert.equal(isJunction(graphNodes(next).get(node.id)), isJunction(node));
  }
});

test('painting first and last edges changes only the requested edge and allocates unique IDs', () => {
  for (const index of [0, 2]) {
    const {doc: next, id} = paintEdge(doc, 10, index, {[ROAD_TAG]: 'small_cart;walk'});
    assert.equal(next.elements.length, 3);
    assert.equal(new Set(next.elements.map(w => w.id)).size, 3);
    assert.deepEqual(next.elements.find(w => w.id === id).nodes, doc.elements[0].nodes.slice(index,index+2));
    assert.equal(next.elements.find(w => w.id !== id && w.id !== 11).tags[ROAD_TAG], 'walk');
  }
});

test('insert then paint either half preserves inherited settings and shared node identity', () => {
  const inserted = insertEdgeNode(doc,10,1,{lat:37.0015,lon:-121.00001});
  const w = inserted.doc.elements[0];
  assert.deepEqual(w.nodes, [1,2,inserted.nodeId,3,4]);
  assert.deepEqual(w.geometry[2], {lat:37.0015,lon:-121});
  assert.deepEqual(w.tags, doc.elements[0].tags);
  const painted = paintEdge(inserted.doc,10,2,{surface:'gravel'}).doc;
  assert.deepEqual(painted.elements.slice(0,3).map(w => w.tags.surface),['paved','gravel','paved']);
  assert.equal(isJunction(graphNodes(painted).get(inserted.nodeId)),false);
  const moved = moveNode(painted,inserted.nodeId,37.0016,-121.0001);
  for (const section of moved.elements.filter(w => w.nodes.includes(inserted.nodeId)))
    assert.deepEqual(section.geometry[section.nodes.indexOf(inserted.nodeId)],{lat:37.0016,lon:-121.0001});
  checkSortingSnapshot(toText(moved));
});

test('repeated painting retains source identity without false junctions', () => {
  const painted = paintEdge(doc,10,0,{highway:'steps'});
  const suffix = painted.doc.elements.find(w => w.nodes[0] === 2);
  const again = paintEdge(painted.doc,suffix.id,0,{surface:'dirt'}).doc;
  assert.deepEqual(again.elements.slice(0,3).map(w => w.tags[SOURCE_WAY_TAG]), ['10','10','10']);
  assert.equal(isJunction(graphNodes(again).get(2)),false);
  assert.equal(isJunction(graphNodes(again).get(3)),false);
  assert.equal(isJunction(graphNodes(again).get(4)),true);
  const inserted = insertEdgeNode(again,painted.id,0,{lat:37.0005,lon:-121});
  assert.equal(inserted.doc.elements[0].tags.highway,'steps');
});

test('clear and custom patches change only their fields; no-ops do not fragment ways', () => {
  assert.equal(paintEdge(doc,10,1,{highway:'footway'}).doc,doc);
  assert.equal(paintEdge(doc,10,1,{highway:'footway'}).changed,false);
  const {doc: next,id} = paintEdge(doc,10,1,{surface:null,smoothness:'good'});
  assert.equal(next.elements.find(w => w.id === id).tags.surface,undefined);
  assert.equal(next.elements.find(w => w.id === id).tags.smoothness,'good');
  assert.equal(next.elements[0].tags.surface,'paved');
  assert.equal(paintEdge(next,id,0,{surface:null}).doc,next);
});

test('invalid targets and patches are rejected; existing endpoints are reused', () => {
  assert.throws(() => paintEdge(doc,99,0,{highway:'steps'}), /existing edge/);
  assert.throws(() => paintEdge(doc,10,3,{highway:'steps'}), /existing edge/);
  assert.throws(() => paintEdge(doc,10,0,{[SOURCE_WAY_TAG]:'fake'}), /reserved/);
  assert.throws(() => paintEdge(doc,10,0,{'bad tag':'x'}), /valid/);
  assert.throws(() => paintEdge(doc,10,0,{surface:42}), /text/);
  assert.throws(() => paintEdge(doc,10,0,{[ROAD_TAG]:'bus'}), /road type/);
  assert.throws(() => insertEdgeNode(doc,10,0,{lat:NaN,lon:1}), /valid point/);
  const endpoint = insertEdgeNode(doc,10,0,{lat:37,lon:-121});
  assert.equal(endpoint.changed,false); assert.equal(endpoint.nodeId,1); assert.equal(endpoint.doc,doc);
});
