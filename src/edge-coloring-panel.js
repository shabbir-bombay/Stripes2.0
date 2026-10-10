import { ROAD_TAG, ROAD_TYPES, COMBINATIONS } from "./graph-sorting.js";
import { EDGE_FIELDS, SOURCE_WAY_TAG, tagColor, edgeTagLabel } from "./edge-editing.js";

export function setupColoringPanel(panel, onChange) {
  panel.innerHTML = `<div class="eyebrow">PAINT ONE EDGE AT A TIME</div>
    <label>Setting to update<select id="sorting-paint-field">${EDGE_FIELDS.map((field) => `<option value="${field.key}">${field.label}</option>`).join("")}</select></label>
    <fieldset id="sorting-paint-users" class="sorting-types"><legend>Allowed road users</legend>${ROAD_TYPES.map((type, i) => `<label><input type="checkbox" name="brushRoadType" value="${type.id}"><span>${type.label} <kbd>${i + 1}</kbd></span></label>`).join("")}</fieldset>
    <label id="sorting-paint-value-label" hidden>Value<select id="sorting-paint-value"></select></label>
    <div id="sorting-paint-custom" hidden><label>Tag name<input id="sorting-paint-key" placeholder="e.g. smoothness" maxlength="100"></label><label>Tag value<input id="sorting-paint-text" placeholder="e.g. good" maxlength="500"></label></div>
    <label id="sorting-paint-remove-label" class="sorting-paint-remove" hidden><input type="checkbox" id="sorting-paint-remove">Clear this setting on clicked edges</label>
    <div id="sorting-paint-preview" class="sorting-current" role="status"></div><p class="sorting-note">Click an edge between two nodes to paint it. Other settings stay unchanged. Press I to insert a node, then K to resume coloring. Esc exits.</p>`;
  const $ = (selector) => panel.querySelector(selector);
  function read() {
    const field = $("#sorting-paint-field").value;
    const key = field === "custom" ? $("#sorting-paint-key").value.trim() : field;
    if (field === ROAD_TAG) {
      const types = [...panel.querySelectorAll('[name="brushRoadType"]:checked')].map((input) => input.value);
      const mask = ROAD_TYPES.reduce((mask, type) => mask | (types.includes(type.id) ? type.bit : 0), 0);
      return { key, value: types.join(";") || null, color: COMBINATIONS[mask].color, label: COMBINATIONS[mask].label };
    }
    const value = $("#sorting-paint-remove").checked ? null : field === "custom" ? $("#sorting-paint-text").value.trim() : $("#sorting-paint-value").value;
    return { key, value, color: tagColor(value), label: edgeTagLabel(key, value) };
  }
  function update(fieldChanged = false) {
    const field = $("#sorting-paint-field").value;
    $("#sorting-paint-users").hidden = field !== ROAD_TAG;
    $("#sorting-paint-custom").hidden = field !== "custom";
    $("#sorting-paint-value-label").hidden = field === ROAD_TAG || field === "custom";
    $("#sorting-paint-remove-label").hidden = field === ROAD_TAG;
    if (fieldChanged) {
      $("#sorting-paint-remove").checked = false;
      $("#sorting-paint-value").replaceChildren(...(EDGE_FIELDS.find((item) => item.key === field)?.values ?? []).map(([value, label]) => new Option(label, value)));
    }
    const brush = read(), preview = $("#sorting-paint-preview");
    preview.replaceChildren();
    const swatch = document.createElement("i"); swatch.className = "sorting-swatch"; swatch.style.background = brush.color;
    preview.append(swatch, document.createTextNode(`Paint: ${brush.label}${field === ROAD_TAG && !brush.value ? " (no users selected)" : ""}`));
    onChange();
  }
  panel.addEventListener("change", (event) => update(event.target.id === "sorting-paint-field"));
  panel.addEventListener("input", (event) => { if (event.target.tagName === "INPUT" && event.target.type === "text") update(); });
  update();
  return {
    read,
    patch() {
      const { key, value } = read();
      if (!key || key === SOURCE_WAY_TAG || ($("#sorting-paint-field").value === "custom" && key === ROAD_TAG)) throw new Error("Choose a tag name, or use Allowed road users to edit access.");
      if (value === "") throw new Error("Enter a tag value, or choose Clear this setting.");
      return { [key]: value };
    },
  };
}
