import { addPoint, guessMapping, validLocation } from './data.js';
export const GATE_SORTING_STORAGE_KEY = 'stripes-gate-sorting-v1';
export const GATE_SORTING_FILE = 'gates.csv';
export const ACCESS_STATES = [
  {value:'',label:'Undefined',color:'#9299a2',key:'3'},
  {value:'yes',label:'Accessible',color:'#2563eb',key:'1'},
  {value:'no',label:'Not accessible',color:'#dc2626',key:'2'},
  {value:'ground_floor',label:'Accessible only on ground floor',color:'#d97706',key:'4'},
];
export function accessValue(value) {
  const text=String(value??'').trim().toLowerCase();
  if(['yes','true','1','accessible'].includes(text)) return 'yes';
  if(['no','false','0','not accessible','inaccessible'].includes(text)) return 'no';
  if(['ground_floor','ground floor only','accessible only ground floor','accessible only on ground floor'].includes(text)) return 'ground_floor';
  return '';
}
export const accessStyle = (point,dataset) => ACCESS_STATES.find(s=>s.value===accessValue(point.cells[dataset.mapping.accessible]));

/** A separate copy with the same point identities, coordinates, and template columns. */
export function prepareGateSorting(source,reset=false) {
  if(!Array.isArray(source?.headers) || !source.headers.every(h=>typeof h==='string') || !Array.isArray(source.points) || source.points.length>10000 || !source.mapping)
    throw new Error('Load a valid points template in Gate Studio first.');
  const {headers,mapping}=source;
  if(!Number.isInteger(mapping.name) || mapping.name<0 || mapping.name>=headers.length)
    throw new Error('The points template needs a gate name column.');
  const ids=new Set();
  for(const point of source.points) {
    if(typeof point.id!=='string' || ids.has(point.id) || !Array.isArray(point.cells) || !point.cells.every(v=>typeof v==='string') || ![point.lat,point.lng].every(v=>v===null || Number.isFinite(v)))
      throw new Error('The points template contains invalid or duplicate points.');
    ids.add(point.id);
  }
  const next=structuredClone(source);
  let index=next.mapping.accessible;
  if(!Number.isInteger(index) || index<0 || index>=next.headers.length) index=guessMapping(next.headers).accessible;
  if(index<0) {index=next.headers.length;next.headers.push('Accessible');}
  next.mapping.accessible=index;
  next.points=next.points.map(point=>{
    const cells=next.headers.map((_,i)=>point.cells[i]??'');
    cells[index]=reset?'':accessValue(cells[index]);
    return {...point,cells};
  });
  return next;
}
export function classifyGate(dataset,id,value) {
  if(!ACCESS_STATES.some(state=>state.value===value)) throw new Error('Choose an accessibility setting.');
  const point=dataset.points.find(p=>p.id===id);
  if(!point) throw new Error('Choose an existing gate point.');
  if(point.cells[dataset.mapping.accessible]===value) return dataset;
  return {...dataset,points:dataset.points.map(p=>p.id===id?{...p,cells:p.cells.map((cell,i)=>i===dataset.mapping.accessible?value:cell)}:p)};
}

export const gateNotesIndex = dataset => dataset.headers.findIndex(header => header.trim().toLowerCase() === 'notes');
export const gateNotes = (point, dataset) => point.cells[gateNotesIndex(dataset)] ?? '';

export function moveSortedGate(dataset, id, lat, lng) {
  if (!validLocation(lat, lng)) throw new Error('Choose a valid location for this gate.');
  const point = dataset.points.find(point => point.id === id);
  if (!point) throw new Error('Choose an existing gate point.');
  lat = Number(lat.toFixed(10)); lng = Number(lng.toFixed(10));
  if (point.lat === lat && point.lng === lng) return dataset;
  return {...dataset, points: dataset.points.map(point => point.id === id ? {...point, lat, lng} : point)};
}

export function addSortedGate(dataset, lat, lng) {
  if (!validLocation(lat, lng)) throw new Error('Choose a valid location for this gate.');
  if (dataset.points.length >= 10000) throw new Error('A dataset can contain at most 10,000 gate points.');
  const next = addPoint(dataset, Number(lat.toFixed(10)), Number(lng.toFixed(10)));
  return {dataset: next, id: next.points.at(-1).id};
}

export function updateGateDetails(dataset, id, changes) {
  const point = dataset.points.find(point => point.id === id);
  if (!point) throw new Error('Choose an existing gate point.');
  if ('name' in changes && (typeof changes.name !== 'string' || !changes.name.trim())) throw new Error('Enter a gate name.');
  if ('notes' in changes && typeof changes.notes !== 'string') throw new Error('Notes must be text.');
  if ('building' in changes && typeof changes.building !== 'string') throw new Error('Building must be text.');
  const headers = [...dataset.headers], mapping = {...dataset.mapping};
  let notesIndex = gateNotesIndex(dataset);
  if ('notes' in changes && notesIndex < 0 && changes.notes !== '') {notesIndex = headers.length; headers.push('Notes');}
  if ('building' in changes && mapping.building < 0 && changes.building.trim()) {mapping.building = headers.length; headers.push('Building Name');}
  const points = dataset.points.map(p => {
    const cells = headers.map((_, index) => p.cells[index] ?? '');
    if (p.id === id) {
      if ('name' in changes) cells[mapping.name] = changes.name.trim();
      if ('building' in changes && mapping.building >= 0) cells[mapping.building] = changes.building.trim();
      if ('notes' in changes && notesIndex >= 0) cells[notesIndex] = changes.notes;
    }
    return {...p, cells};
  });
  if (headers.length === dataset.headers.length && points.every((p, index) => p.cells.every((value, i) => value === dataset.points[index].cells[i]))) return dataset;
  return {...dataset, headers, mapping, points};
}

export function deleteSortedGate(dataset, id) {
  if (!dataset.points.some(point => point.id === id)) throw new Error('Choose an existing gate point.');
  return {...dataset, points: dataset.points.filter(point => point.id !== id)};
}
