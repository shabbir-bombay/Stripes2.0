import L from "leaflet";
import "./leaflet-global.js";
import "leaflet-imageoverlay-rotated";
import { corners, fromCorner } from "./paths.js";
import { parseCoordinate, validLocation } from "./data.js";

// A reference image (e.g. the printed campus map) laid over the map to trace paths from.
// Kept in this browser only. Placement is a centre, a width in metres and a clockwise rotation.

const STORAGE_KEY = "stripes-path-image-v1";
export function setupCampusImage(map, { panel, button, toast }) {
  map.createPane("campusImage").style.zIndex = 350; // above the basemap, below paths
  let state = null, overlay = null;
  const handles = L.layerGroup().addTo(map);
  const handle = (className) =>
    L.marker([0, 0], { draggable: true, keyboard: true, icon: L.divIcon({ className: `image-handle ${className}`, html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] }) });
  const move = handle("move").bindTooltip("Drag to move");
  const turn = handle("turn").bindTooltip("Drag to rotate and resize");
  move.on("drag", () => update({ center: move.getLatLng() }, false));
  turn.on("drag", () => update(fromCorner(state, turn.getLatLng()), false));
  for (const h of [move, turn]) h.on("dragend", () => update({}));

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast("The image is too large to keep in this browser. It will be gone after a reload.");
    }
  }

  function place() {
    const [tl, tr, bl] = corners(state);
    if (!overlay) overlay = L.imageOverlay.rotated(state.src, tl, tr, bl, { pane: "campusImage", opacity: state.opacity, interactive: false });
    overlay.reposition(tl, tr, bl);
    overlay.setOpacity(state.opacity);
    if (state.visible) overlay.addTo(map);
    else overlay.remove();
    move.setLatLng(state.center);
    turn.setLatLng(tr);
    for (const h of [move, turn]) {
      if (state.visible && !state.locked) handles.addLayer(h);
      else handles.removeLayer(h);
    }
  }

  function update(changes, rerender = true) {
    state = { ...state, ...changes };
    if (changes.center) state.center = { lat: changes.center.lat, lng: changes.center.lng };
    place();
    if (rerender) {
      save();
      render();
    }
  }

  function render() {
    button.classList.toggle("is-active", !panel.hidden);
    if (!state) {
      panel.innerHTML = `<div class="image-panel-heading"><strong>Campus image</strong></div><p class="muted">Lay a campus map over this one to trace paths.</p><button id="image-upload" class="primary full-width">Upload image</button><input id="image-file" type="file" accept="image/*" hidden />`;
      return;
    }
    panel.innerHTML = `<div class="image-panel-heading"><strong>Campus image</strong><label class="checkbox-inline"><input id="image-visible" type="checkbox" ${state.visible ? "checked" : ""}/> Show</label></div>
      <label>Opacity <span>${Math.round(state.opacity * 100)}%</span><input id="image-opacity" type="range" min="0" max="1" step="0.05" value="${state.opacity}"/></label>
      <label>Centre (lat, lng)<input id="image-center" value="${state.center.lat.toFixed(7)}, ${state.center.lng.toFixed(7)}" ${state.locked ? "disabled" : ""} spellcheck="false"/></label>
      <div class="image-panel-row"><label>Rotation (°)<input id="image-rotation" type="number" step="0.1" value="${state.rotation.toFixed(1)}" ${state.locked ? "disabled" : ""}/></label><label>Width (m)<input id="image-width" type="number" step="1" min="10" value="${Math.round(state.width)}" ${state.locked ? "disabled" : ""}/></label></div>
      <button id="image-copy">Copy placement</button>
      <button id="image-lock" class="${state.locked ? "" : "dark"} full-width">${state.locked ? "Unlock to adjust" : "Lock in place"}</button>
      <div class="image-panel-row"><button id="image-upload">Replace</button><button id="image-remove" class="text-danger">Remove</button></div><input id="image-file" type="file" accept="image/*" hidden />`;
  }

  async function upload(file) {
    if (!file?.type.startsWith("image/")) return toast("Choose an image file.");
    const src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = src;
    await img.decode();
    // Fit the whole image, handles included, inside the visible map.
    const bounds = map.getBounds(), aspect = img.naturalHeight / img.naturalWidth;
    const viewWidth = map.distance(bounds.getSouthWest(), bounds.getSouthEast());
    const viewHeight = map.distance(bounds.getSouthWest(), bounds.getNorthWest());
    const widthM = Math.min(viewWidth, viewHeight / aspect) * 0.7;
    overlay?.remove();
    overlay = null;
    if (state) {
      // Replacing keeps the placement, so a new version of the map lands where the old one was.
      state = { ...state, src, aspect };
      update({});
      return toast("Image replaced in the same place.");
    }
    state = { src, center: map.getCenter(), width: widthM, aspect, rotation: 0, opacity: 0.6, locked: false, visible: true };
    update({ center: map.getCenter() });
    toast("Drag the centre handle to move it and the corner handle to rotate and resize. Then lock it.");
  }

  panel.addEventListener("click", (event) => {
    const id = event.target.closest("button")?.id;
    if (id === "image-upload") panel.querySelector("#image-file").click();
    if (id === "image-lock") {
      // Locking means placement is done: tuck the panel away. Campus image brings it back.
      if (!state.locked) panel.hidden = true;
      update({ locked: !state.locked });
    }
    if (id === "image-copy") {
      const text = `Centre ${state.center.lat.toFixed(7)}, ${state.center.lng.toFixed(7)} · rotation ${state.rotation.toFixed(1)}° · width ${Math.round(state.width)} m`;
      navigator.clipboard.writeText(text).then(() => toast(`Copied: ${text}`), () => toast(text));
    }
    if (id === "image-remove" && confirm("Remove the campus image from this browser?")) {
      overlay?.remove();
      overlay = null;
      state = null;
      handles.clearLayers();
      localStorage.removeItem(STORAGE_KEY);
      render();
    }
  });
  panel.addEventListener("input", (event) => {
    const { id, value } = event.target;
    if (id === "image-opacity") {
      update({ opacity: Number(value) }, false);
      event.target.previousElementSibling.textContent = `${Math.round(value * 100)}%`;
    }
    if (id === "image-rotation" && value !== "") update({ rotation: Number(value) }, false);
    if (id === "image-width" && Number(value) >= 10) update({ width: Number(value) }, false);
  });
  panel.addEventListener("change", (event) => {
    const { id, checked, files } = event.target;
    if (id === "image-file") upload(files[0]).catch(() => toast("That image could not be read."));
    else if (id === "image-center") {
      const [lat, lng] = event.target.value.split(/[,;]/).map((part, i) => parseCoordinate(part, i ? "lng" : "lat"));
      if (validLocation(lat, lng)) {
        update({ center: { lat, lng } });
        map.panTo([lat, lng]);
      } else toast("Enter the centre as latitude, longitude, e.g. 37.9803, -121.3112.");
    }
    else if (id === "image-visible") update({ visible: checked });
    else save(); // slider and number edits
  });
  button.onclick = () => {
    panel.hidden = !panel.hidden;
    render();
  };

  try {
    state = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    state = null;
  }
  if (state?.src) place();
  else state = null;
  render();
}
