import L from 'leaflet';
import { setupBasemap } from './basemap.js';
import { icon } from './icons.js';
import { emptyDataset,pointName,validLocation,exportCsv,readFileData,createDataset,guessMapping } from './data.js';
import { ACCESS_STATES,GATE_SORTING_STORAGE_KEY,GATE_SORTING_FILE,prepareGateSorting,classifyGate,accessStyle,addSortedGate,moveSortedGate,updateGateDetails,gateNotes,deleteSortedGate } from './gate-sorting.js';
import { isEditingField } from './sorting-shortcuts.js';
const $=s=>document.querySelector(s);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let started=false,map,layer,toast,hasDataset=false,busy=false;
let dataset=emptyDataset(),brush='yes',undo=[],redo=[],search='',filter='all';
let mode='paint',selectedId=null,historyGroup=null,pendingDelete=null;

export function showGateSorting(showToast) {
  toast=showToast;
  if(!started) start();
  map.invalidateSize();
}
function start() {
  started=true;
  $('#gate-sorting-actions').innerHTML=`<button id="gate-sort-repo">Load repo data</button><button id="gate-sort-upload">${icon('upload')} Upload CSV</button><button id="gate-sort-download">${icon('download')} Download CSV</button><input id="gate-sort-file" type="file" accept=".csv,.xlsx" hidden>`;
  $('#gate-sorting-workspace').innerHTML=`<aside class="sidebar gate-sorting-sidebar" aria-label="Gate accessibility sorting">
    <div class="sidebar-top"><div class="eyebrow">GATE ACCESSIBILITY</div><h1>Gate Studio</h1><p class="muted">Paint accessibility, or edit gates and notes.</p>
      <div class="gate-sort-source"><strong id="gate-sort-source">No points yet</strong><small>Upload a CSV or Excel file of gates. Positions, notes, and sorting save in this browser; Download to keep a copy.</small></div>
      <div class="gate-sort-brushes" role="group" aria-label="Accessibility brush">${[ACCESS_STATES[1],ACCESS_STATES[2],ACCESS_STATES[0],ACCESS_STATES[3]].map(s=>`<button data-gate-brush="${s.value}" aria-pressed="${s.value===brush}"><i style="background:${s.color}"></i>${s.label}<kbd>${s.key}</kbd></button>`).join('')}</div>
      <button id="gate-sort-edit-mode" class="full-width" aria-pressed="false">Edit gates & notes <kbd>E</kbd></button>
      <p id="gate-sort-paint-note" role="status"></p><p id="gate-sort-progress"></p><progress id="gate-sort-meter" max="1" value="0" aria-label="Classified gates"></progress>
      <p id="gate-sort-invalid" class="gate-sort-note" hidden></p>
      <label class="search-box">${icon('search')}<input id="gate-sort-search" type="search" placeholder="Search building or gate…" aria-label="Search gate sorting points"></label>
      <label class="sr-only" for="gate-sort-filter">Filter accessibility</label><select id="gate-sort-filter"><option value="all">All points</option>${ACCESS_STATES.map(s=>`<option value="${s.value}">${s.label}</option>`).join('')}</select>
    </div><div class="point-list" id="gate-sort-list"></div>
    <div class="sidebar-bottom"><span id="gate-sort-storage" role="status">Draft saved in this browser</span><small>1: Accessible · 2: Not accessible · 3: Undefined · 4: Ground floor only<br>E: Edit · A: Add point · M: Move · N: Delete<br>Z/Y: Undo/Redo · F: Fit · Esc: Cancel tool. Shortcuts pause in fields.</small></div>
    </aside><section class="map-workspace" aria-label="Gate sorting map"><div id="gate-sort-map"></div>
      <div class="map-toolbar gate-sort-toolbar"><div class="segmented" id="gate-sort-basemap" aria-label="Map style"></div><div class="map-actions"><div class="history-buttons"><button id="gate-sort-undo" aria-label="Undo gate sorting">${icon('undo')}</button><button id="gate-sort-redo" aria-label="Redo gate sorting">${icon('redo')}</button></div><button id="gate-sort-fit">${icon('fit')} Fit points</button><button id="gate-sort-add" aria-pressed="false">${icon('plus')} Add point <kbd>A</kbd></button></div></div>
      <section id="gate-sort-editor" class="editor gate-sort-editor" aria-label="Gate details" hidden></section>
      <div class="gate-sort-legend">${ACCESS_STATES.map(s=>`<span><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</div>
    </section><dialog id="gate-sort-delete-dialog" aria-labelledby="gate-sort-delete-title"><h2 id="gate-sort-delete-title">Delete gate point?</h2><p id="gate-sort-delete-description"></p><p>You can undo this deletion.</p><div class="dialog-actions"><button id="gate-sort-delete-cancel" autofocus>Cancel</button><button id="gate-sort-delete-confirm" class="danger">Delete point</button></div></dialog>`;
  map=L.map('gate-sort-map',{zoomControl:false,maxZoom:22}).setView([37.9795,-121.311],16);
  L.control.zoom({position:'bottomleft'}).addTo(map);layer=L.layerGroup().addTo(map);
  setupBasemap(map,$('#gate-sort-basemap'),{overlay:()=>({type:'FeatureCollection',features:[]})});
  $('#gate-sort-basemap [data-basemap="3d"]').remove();
  new ResizeObserver(()=>map.invalidateSize()).observe($('#gate-sort-map'));
  for(const button of document.querySelectorAll('[data-gate-brush]')) button.onclick=()=>{if(!busy){brush=button.dataset.gateBrush;mode='paint';render();}};
  $('#gate-sort-search').oninput=e=>{search=e.target.value.toLowerCase();renderList();};
  $('#gate-sort-filter').onchange=e=>{filter=e.target.value;renderList();};
  $('#gate-sort-list').onclick=e=>{
    const row=e.target.closest('[data-gate-point]');if(!row||busy)return;
    selectPoint(row.dataset.gatePoint);
    const point=dataset.points.find(p=>p.id===row.dataset.gatePoint);
    if(validLocation(point.lat,point.lng))map.setView([point.lat,point.lng],Math.max(map.getZoom(),18));
  };
  $('#gate-sort-edit-mode').onclick=()=>{if(!busy){mode=mode==='edit'?'paint':'edit';historyGroup=null;render();}};
  $('#gate-sort-add').onclick=()=>{if(!busy){mode=mode==='add'?'edit':'add';historyGroup=null;render();}};
  map.on('click',({latlng})=>{
    if(busy)return;
    act(()=>{
      if(mode==='add') {
        const next=addSortedGate(dataset,latlng.lat,latlng.lng);
        selectedId=next.id;mode='edit';commit(next.dataset);toast('Point added. Give it a name and optional notes.');
      } else if(mode==='move' && selectedId) {
        const next=moveSortedGate(dataset,selectedId,latlng.lat,latlng.lng);
        mode='edit';if(!commit(next))render();
      }
    });
  });
  $('#gate-sort-editor').onclick=e=>{
    if(busy)return;
    if(e.target.closest('#gate-sort-details-close')){selectedId=null;render();}
    if(e.target.closest('#gate-sort-move')){mode='move';render();}
    if(e.target.closest('#gate-sort-delete')){
      const point=dataset.points.find(p=>p.id===selectedId);if(!point)return;
      pendingDelete={id:point.id,before:dataset};
      $('#gate-sort-delete-description').textContent=`Remove ${pointName(point,dataset.mapping)} and its notes from this sorting draft?`;
      $('#gate-sort-delete-dialog').showModal();
    }
  };
  $('#gate-sort-delete-cancel').onclick=()=>$('#gate-sort-delete-dialog').close();
  $('#gate-sort-delete-dialog').onclose=()=>{pendingDelete=null;};
  $('#gate-sort-delete-confirm').onclick=()=>{
    const pending=pendingDelete;$('#gate-sort-delete-dialog').close();
    if(!pending||busy)return;
    if(pending.before!==dataset)return toast('The graph changed. Select the point and delete it again.');
    act(()=>{mode='edit';commit(deleteSortedGate(dataset,pending.id));toast('Point deleted. Press Z to undo.');});
  };
  $('#gate-sort-editor').onchange=e=>{
    const field={'gate-sort-name':'name','gate-sort-building':'building'}[e.target.id];
    if(!field||busy)return;
    try{commit(updateGateDetails(dataset,selectedId,{[field]:e.target.value}),null,true);}
    catch(error){toast(error.message);e.target.value=dataset.points.find(p=>p.id===selectedId).cells[dataset.mapping[field]]??'';}
  };
  $('#gate-sort-editor').oninput=e=>{
    if(e.target.id==='gate-sort-notes'&&!busy)act(()=>commit(updateGateDetails(dataset,selectedId,{notes:e.target.value}),`notes:${selectedId}`,true));
  };
  $('#gate-sort-editor').addEventListener('focusin',()=>{historyGroup=null;});
  $('#gate-sort-editor').addEventListener('focusout',()=>{historyGroup=null;});
  $('#gate-sort-repo').onclick=()=>loadRepo();
  $('#gate-sort-upload').onclick=()=>$('#gate-sort-file').click();
  $('#gate-sort-file').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';
    if(!file||busy||(hasDataset&&!confirm('Replace this sorting draft with the uploaded file? Download your draft first to keep a copy.')))return;
    try{
      const [table]=await readFileData(await file.arrayBuffer(),file.name);
      replace(prepareGateSorting(createDataset(table,guessMapping(table.headers),file.name)));
      toast(`Loaded ${dataset.points.length} points from ${file.name}.`);
    }catch(error){toast(error.message);}
  };
  $('#gate-sort-undo').onclick=()=>step(false);$('#gate-sort-redo').onclick=()=>step(true);
  $('#gate-sort-fit').onclick=fit;
  $('#gate-sort-download').onclick=()=>act(()=>{
    const blob=new Blob([exportCsv(dataset)],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=GATE_SORTING_FILE;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  document.addEventListener('keydown',e=>{
    if(document.body.dataset.studio!=='gate-sorting'||busy||e.defaultPrevented||e.repeat||e.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||document.querySelector('dialog[open]'))return;
    if([document.activeElement,e.target,...e.composedPath()].some(isEditingField))return;
    if(e.key==='Escape'){e.preventDefault();if(mode==='add'||mode==='move')mode='edit';else selectedId=null;render();return;}
    const key=e.key.toLowerCase(),state=ACCESS_STATES.find(s=>s.key===key);
    const control=state?$(`[data-gate-brush="${state.value}"]`):$({z:'#gate-sort-undo',y:'#gate-sort-redo',f:'#gate-sort-fit',e:'#gate-sort-edit-mode',a:'#gate-sort-add',m:'#gate-sort-move',n:'#gate-sort-delete'}[key]??'#gate-sort-no-action');
    if(control&&!control.disabled&&control.checkVisibility()){e.preventDefault();control.click();}
  });
  try {
    const saved=JSON.parse(localStorage.getItem(GATE_SORTING_STORAGE_KEY)??'null');
    if(saved?.dataset){dataset=prepareGateSorting(saved.dataset);hasDataset=true;}
  }catch(error){toast(`Could not restore gate sorting: ${error.message}`);}
  render();fit();
  if(!hasDataset)loadRepo(false);
}
async function loadRepo(ask=true){
  if(busy||(ask&&hasDataset&&!confirm('Replace this draft with gates.csv from the repo? Download your draft first to keep a copy.')))return;
  try{
    const response=await fetch(`./${GATE_SORTING_FILE}`,{cache:'no-cache'});
    if(!response.ok)throw new Error(`Could not load ${GATE_SORTING_FILE} from the repo.`);
    const [table]=await readFileData(await response.arrayBuffer(),GATE_SORTING_FILE);
    replace(prepareGateSorting(createDataset(table,guessMapping(table.headers),GATE_SORTING_FILE)));
    if(ask)toast(`Loaded ${dataset.points.length} points from the repo.`);
  }catch(error){toast(error.message);}
}
function act(task){try{task();}catch(error){toast(error.message);}}
function persist(){
  try{localStorage.setItem(GATE_SORTING_STORAGE_KEY,JSON.stringify({dataset}));$('#gate-sort-storage').textContent='Draft saved in this browser';}
  catch{$('#gate-sort-storage').textContent='Draft not saved — download a CSV to keep it';toast('Browser storage is unavailable. Download your sorting to keep it.');}
}
function replace(next){dataset=next;hasDataset=true;undo=[];redo=[];selectedId=null;mode='paint';historyGroup=null;search='';filter='all';$('#gate-sort-search').value='';$('#gate-sort-filter').value='all';persist();render();fit();}
function commit(next,group=null,keepEditor=false){
  if(next===dataset)return false;
  if(!group||group!==historyGroup){undo.push(dataset);if(undo.length>80)undo.shift();}
  historyGroup=group;redo=[];dataset=next;hasDataset=true;persist();render(keepEditor);return true;
}
function selectPoint(id){
  if(busy)return;
  historyGroup=null;
  if(mode==='paint')act(()=>commit(classifyGate(dataset,id,brush)));
  else if(mode==='edit'){selectedId=id;render();}
  else toast('Click the map at the new location, or press Esc to cancel.');
}
function step(forward){if(busy)return;const [from,to]=forward?[redo,undo]:[undo,redo];if(!from.length)return;to.push(dataset);dataset=from.pop();historyGroup=null;if(mode==='add'||mode==='move')mode='edit';persist();render();}
function renderBrush(){
  for(const button of document.querySelectorAll('[data-gate-brush]')){button.setAttribute('aria-pressed',String(mode==='paint'&&button.dataset.gateBrush===brush));button.disabled=busy;}
  $('#gate-sort-paint-note').textContent={paint:`Painting: ${ACCESS_STATES.find(s=>s.value===brush).label}. Click dots or list entries to apply.`,edit:'Click a gate for its name and optional notes. Drag dots to move them.',add:'Click the map to place a new undefined gate. Esc cancels.',move:'Click the new location for the selected gate. Esc cancels.'}[mode];
  $('#gate-sort-edit-mode').setAttribute('aria-pressed',String(mode==='edit'));
  $('#gate-sort-add').setAttribute('aria-pressed',String(mode==='add'));
  $('#gate-sort-edit-mode').disabled=$('#gate-sort-add').disabled=busy;
  $('#gate-sort-map').classList.toggle('placing',mode==='add'||mode==='move');
}
function render(keepEditor=false){
  if(!dataset.points.some(p=>p.id===selectedId))selectedId=null;
  const counts=ACCESS_STATES.map(s=>dataset.points.filter(p=>accessStyle(p,dataset).value===s.value).length);
  $('#gate-sort-source').textContent=hasDataset?dataset.filename:'No gates loaded yet';
  $('#gate-sort-progress').textContent=`${counts[1]} accessible · ${counts[2]} not accessible · ${counts[3]} ground floor only · ${counts[0]} undefined`;
  $('#gate-sort-meter').max=dataset.points.length||1;$('#gate-sort-meter').value=dataset.points.length-counts[0];
  const invalid=dataset.points.filter(p=>!validLocation(p.lat,p.lng)).length;
  $('#gate-sort-invalid').hidden=!invalid;$('#gate-sort-invalid').textContent=`${invalid} point(s) have invalid coordinates and cannot appear on the map. Use Edit gates, select one from the list, then Move point to set its location. Download requires valid coordinates.`;
  $('#gate-sort-undo').disabled=busy||!undo.length;$('#gate-sort-redo').disabled=busy||!redo.length;
  $('#gate-sort-download').disabled=busy||!dataset.points.length||Boolean(invalid);
  $('#gate-sort-upload').disabled=busy;
  renderBrush();renderList();if(!keepEditor)renderEditor();layer.clearLayers();
  for(const point of dataset.points){
    if(!validLocation(point.lat,point.lng))continue;
    const style=accessStyle(point,dataset),name=pointName(point,dataset.mapping);
    const marker=L.marker([point.lat,point.lng],{keyboard:true,draggable:mode==='edit'&&!busy,bubblingMouseEvents:false,title:`${name} · ${style.label}`,icon:L.divIcon({className:`gate-sort-dot ${point.id===selectedId&&mode!=='paint'?'selected':''}`,html:`<span style="background:${style.color}"></span>`,iconSize:[16,16]})}).addTo(layer);
    marker.bindTooltip(`${escape(name)} · ${style.label}`);marker.on('click',()=>selectPoint(point.id));
    marker.on('dragend',()=>{
      if(busy||mode!=='edit')return;
      selectedId=point.id;const position=marker.getLatLng();
      act(()=>{if(!commit(moveSortedGate(dataset,point.id,position.lat,position.lng)))render();});
    });
  }
}
function renderList(){
  const points=dataset.points.filter(p=>(filter==='all'||accessStyle(p,dataset).value===filter)&&`${pointName(p,dataset.mapping)} ${gateNotes(p,dataset)}`.toLowerCase().includes(search));
  $('#gate-sort-list').innerHTML=points.length?points.map(p=>{const style=accessStyle(p,dataset);return `<button class="point-row ${p.id===selectedId&&mode!=='paint'?'selected':''}" data-gate-point="${escape(p.id)}" ${busy?'disabled':''}><i class="sorting-swatch" style="background:${style.color}"></i><span class="point-row-text"><strong>${escape(pointName(p,dataset.mapping))}</strong><small>${style.label}${gateNotes(p,dataset)?' · Has notes':''}${validLocation(p.lat,p.lng)?'':' · Needs coordinates'}</small></span></button>`;}).join(''):'<div class="empty-list"><strong>No matching points</strong><p>Upload a CSV or change the filter.</p></div>';
}
function renderEditor(){
  const panel=$('#gate-sort-editor'),point=dataset.points.find(p=>p.id===selectedId);
  panel.hidden=!point||mode==='paint'||mode==='add';
  if(panel.hidden)return;
  panel.innerHTML=`<div class="editor-heading"><h2>Gate details</h2><button id="gate-sort-details-close" class="icon-button" aria-label="Close gate details">${icon('close')}</button></div>
    <p class="gate-sort-note">${accessStyle(point,dataset).label} · Changes save automatically.</p>
    <label>Gate name<input id="gate-sort-name" value="${escape(point.cells[dataset.mapping.name])}" required ${busy?'disabled':''}></label>
    <label>Building (optional)<input id="gate-sort-building" value="${escape(point.cells[dataset.mapping.building]??'')}" ${busy?'disabled':''}></label>
    <label>Notes (optional)<textarea id="gate-sort-notes" rows="4" placeholder="Entry instructions, access details…" ${busy?'disabled':''}>${escape(gateNotes(point,dataset))}</textarea></label>
    <p class="gate-sort-note">${validLocation(point.lat,point.lng)?`${point.lat.toFixed(7)}, ${point.lng.toFixed(7)}`:'No valid location yet'}</p>
    <button id="gate-sort-move" ${busy?'disabled':''}>Move point <kbd>M</kbd></button><p class="gate-sort-note">Drag the dot, or choose Move point and click its new location.</p><button id="gate-sort-delete" class="text-danger" ${busy?'disabled':''}>Delete point <kbd>N</kbd></button>`;
}
function fit(){const points=dataset.points.filter(p=>validLocation(p.lat,p.lng));if(points.length)map.fitBounds(points.map(p=>[p.lat,p.lng]),{padding:[60,60],maxZoom:19});}
