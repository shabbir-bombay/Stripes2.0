import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataset,guessMapping,exportCsv,readFileData} from './data.js';
import {prepareGateSorting,classifyGate,accessStyle,addSortedGate,moveSortedGate,updateGateDetails,gateNotes,deleteSortedGate} from './gate-sorting.js';
const headers=['Building Name','Door Name','Latitude','Longitude','Accessible','Notes'];
const source=createDataset({name:'Gates',headers,rows:[['Hall','A','37','-121','yes','Keep me'],['Hall','B','37.001','-121','no','Keep too']]},guessMapping(headers),'gates.csv');
test('new sorting copy starts gray without altering source identities, positions or other cells',()=>{
 const before=JSON.stringify(source),copy=prepareGateSorting(source,true);
 assert.deepEqual(copy.points.map(p=>accessStyle(p,copy).value),['','']);
 assert.deepEqual(copy.points.map(p=>[p.id,p.lat,p.lng,p.cells[5]]),source.points.map(p=>[p.id,p.lat,p.lng,p.cells[5]]));
 assert.equal(JSON.stringify(source),before);
 assert.notEqual(copy.points[0].cells,source.points[0].cells);
});
test('painting affects only the clicked point and supports both colors and reset',()=>{
 const gray=prepareGateSorting(source,true),blue=classifyGate(gray,'import-0','yes'),red=classifyGate(blue,'import-1','no');
 assert.equal(accessStyle(red.points[0],red).color,'#2563eb');
 assert.equal(accessStyle(red.points[1],red).color,'#dc2626');
 assert.equal(gray.points[0].cells[4],'');
 assert.equal(blue.points[1],gray.points[1]);
 assert.equal(classifyGate(red,'import-1','no'),red);
 assert.equal(accessStyle(classifyGate(red,'import-0','').points[0],red).color,'#9299a2');
 assert.throws(()=>classifyGate(red,'missing','yes'),/existing/);
 assert.throws(()=>classifyGate(red,'import-0','maybe'),/setting/);
});
test('adds missing accessibility column and CSV round-trips all three states',async()=>{
 const base=structuredClone(source);base.headers.splice(4,1);base.mapping.accessible=-1;base.points.forEach(p=>p.cells.splice(4,1));
 let copy=prepareGateSorting(base,true);assert.equal(copy.headers.at(-1),'Accessible');
 copy=classifyGate(copy,'import-0','no');
 const [table]=await readFileData(new TextEncoder().encode(exportCsv(copy)),'gates-sorted.csv');
 const loaded=prepareGateSorting(createDataset(table,guessMapping(table.headers),'gates-sorted.csv'));
 assert.deepEqual(loaded.points.map(p=>accessStyle(p,loaded).value),['no','']);
 assert.equal(loaded.points[0].cells[4],'Keep me');
 const yes=classifyGate(loaded,loaded.points[1].id,'yes');
 assert.match(exportCsv(yes),/yes/);
});
test('restoring classifications preserves values and invalid coordinates remain available for review',()=>{
 const sourceCopy=structuredClone(source);sourceCopy.points[0].cells[4]='TRUE';sourceCopy.points[1].lat=null;
 const next=prepareGateSorting(sourceCopy);
 assert.deepEqual(next.points.map(p=>accessStyle(p,next).value),['yes','no']);
 assert.equal(next.points[1].lat,null);
 assert.throws(()=>exportCsv(next),/valid coordinates/);
 const bad=structuredClone(source);bad.points[1].id=bad.points[0].id;
 assert.throws(()=>prepareGateSorting(bad),/duplicate/);
});

test('ground-floor-only accessibility survives painting, draft restore, and CSV round-trip',async()=>{
 const before=prepareGateSorting(source,true);
 const painted=classifyGate(before,'import-0','ground_floor');
 const style=accessStyle(painted.points[0],painted);
 assert.equal(style.color,'#d97706');assert.equal(style.key,'4');
 assert.equal(before.points[0].cells[4],'');assert.equal(painted.points[1],before.points[1]);
 const restored=prepareGateSorting(JSON.parse(JSON.stringify(painted)));
 assert.equal(accessStyle(restored.points[0],restored).value,'ground_floor');
 const [table]=await readFileData(new TextEncoder().encode(exportCsv(restored)),'gates-sorted.csv');
 const loaded=prepareGateSorting(createDataset(table,guessMapping(table.headers),'gates-sorted.csv'));
 assert.deepEqual(loaded.points.map(p=>accessStyle(p,loaded).value),['ground_floor','']);
 assert.equal(accessStyle(prepareGateSorting(loaded,true).points[0],loaded).value,'');
});


test('moving a sorted gate preserves its identity, accessibility, notes, and undo source',()=>{
 const before=classifyGate(prepareGateSorting(source),'import-0','ground_floor');
 const text=JSON.stringify(before),moved=moveSortedGate(before,'import-0',37.123456789123,-121.234567891234);
 assert.equal(moved.points[0].lat,37.1234567891);assert.equal(moved.points[0].lng,-121.2345678912);
 assert.equal(moved.points[0].id,'import-0');assert.deepEqual(moved.points[0].cells,before.points[0].cells);
 assert.equal(gateNotes(moved.points[0],moved),'Keep me');
 assert.equal(moved.points[1],before.points[1]);assert.equal(JSON.stringify(before),text);
 assert.equal(moveSortedGate(moved,'import-0',moved.points[0].lat,moved.points[0].lng),moved);
 assert.throws(()=>moveSortedGate(before,'import-0',91,0),/valid location/);
 assert.throws(()=>moveSortedGate(before,'missing',37,-121),/existing/);
});
test('new gates get unique names, blank optional fields and undefined accessibility',()=>{
 const before=prepareGateSorting(source),first=addSortedGate(before,37.2,-121.2),second=addSortedGate(first.dataset,37.3,-121.3);
 const point=first.dataset.points.at(-1);
 assert.notEqual(first.id,second.id);assert.equal(new Set(second.dataset.points.map(p=>p.id)).size,4);
 assert.equal(accessStyle(point,first.dataset).value,'');assert.equal(gateNotes(point,first.dataset),'');
 assert.notEqual(point.cells[first.dataset.mapping.name],second.dataset.points.at(-1).cells[second.dataset.mapping.name]);
 assert.equal(before.points.length,2);assert.throws(()=>addSortedGate(before,NaN,0),/valid location/);
});
test('optional notes reuse the template column and round-trip commas, quotes and line breaks',async()=>{
 const before=prepareGateSorting(source),notes='Side entrance, "ring bell"\nGround floor only';
 const updated=updateGateDetails(before,'import-0',{notes,name:'Side gate',building:'Hall annex'});
 assert.equal(updated.headers.filter(h=>h==='Notes').length,1);
 assert.equal(gateNotes(updated.points[1],updated),'Keep too');assert.equal(gateNotes(before.points[0],before),'Keep me');
 const moved=moveSortedGate(updated,'import-0',37.25,-121.25);
 const [table]=await readFileData(new TextEncoder().encode(exportCsv(moved)),'gates-sorted.csv');
 const loaded=prepareGateSorting(createDataset(table,guessMapping(table.headers),'gates-sorted.csv'));
 assert.equal(gateNotes(loaded.points[0],loaded),notes);assert.equal(loaded.points[0].lat,37.25);
 assert.equal(loaded.points[0].cells[loaded.mapping.name],'Side gate');
 const cleared=updateGateDetails(updated,'import-0',{notes:''});assert.equal(gateNotes(cleared.points[0],cleared),'');
 assert.equal(updateGateDetails(cleared,'import-0',{notes:''}),cleared);
 assert.throws(()=>updateGateDetails(before,'import-0',{name:' '}),/gate name/);
});
test('notes are optional and append a column only when needed on older templates',()=>{
 const legacy=structuredClone(source);legacy.headers.pop();legacy.points.forEach(p=>p.cells.pop());
 const before=prepareGateSorting(legacy);
 assert.equal(updateGateDetails(before,'import-0',{notes:''}),before);
 const updated=updateGateDetails(before,'import-0',{notes:'Ramp by west door'});
 assert.equal(updated.headers.at(-1),'Notes');assert.equal(updated.points[1].cells.at(-1),'');
 assert.equal(before.headers.length,5);
 const restored=prepareGateSorting(JSON.parse(JSON.stringify(updated)));
 assert.equal(gateNotes(restored.points[0],restored),'Ramp by west door');
});

test('deleting a gate removes only that point and leaves an immutable snapshot for undo',()=>{
 const before=prepareGateSorting(source),text=JSON.stringify(before);
 const next=deleteSortedGate(before,'import-0');
 assert.deepEqual(next.points.map(p=>p.id),['import-1']);
 assert.equal(next.points[0],before.points[1]);assert.equal(JSON.stringify(before),text);
 assert.equal(gateNotes(before.points[0],before),'Keep me');
 assert.equal(deleteSortedGate(next,'import-1').points.length,0);
 assert.throws(()=>deleteSortedGate(before,'missing'),/existing/);
});
