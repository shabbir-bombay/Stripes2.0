import "leaflet/dist/leaflet.css";
import "./style.css";
import "./graph-sorting.css";
import "./gate-sorting.css";
import { showPathStudio } from "./path-studio.js";
import { showGraphSorting } from "./graph-sorting-studio.js";
import { showGateSorting } from "./gate-sorting-studio.js";
import { icon } from "./icons.js";

const $ = (selector) => document.querySelector(selector);
let toastTimer;

$("#app").innerHTML = `
  <header class="app-header">
    <div class="brand-row"><a class="brand" href="./" aria-label="Stripes studio home"><span class="brand-mark">${icon("pin")}</span><span><strong>STRIPES</strong><small>Campus Studio</small></span></a><nav class="segmented studio-switch" aria-label="Studio"><button data-studio="paths">Path Studio</button><button data-studio="gate-sorting">Gate Studio</button></nav></div>
    <div class="header-actions" id="path-actions"></div>
    <div class="header-actions" id="sorting-actions"></div>
    <div class="header-actions" id="gate-sorting-actions"></div>
  </header>
  <nav class="path-sections" aria-label="Path Studio sections"><button data-section="paths">01 <span>Graphing</span></button><button data-section="sorting">02 <span>Graph Sorting</span></button></nav>
  <main class="workspace" id="path-workspace"></main>
  <main class="workspace" id="sorting-workspace"></main>
  <main class="workspace" id="gate-sorting-workspace"></main>
  <div class="toast" id="toast" role="status" hidden></div>
`;

function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 5000);
}

// Path Studio has two sections: Graphing ("paths") and Graph Sorting ("sorting").
const HASHES = { paths: "#paths", sorting: "#paths/sorting", "gate-sorting": "#gates" };
let lastPathSection = "paths";

function showStudio(name) {
  if (name !== "gate-sorting") lastPathSection = name;
  document.body.dataset.studio = name;
  document.title = `${name === "paths" ? "Graphing · Path" : name === "sorting" ? "Graph Sorting · Path" : "Gate"} Studio · Stripes`;
  for (const button of document.querySelectorAll("[data-studio]")) {
    const active = button.dataset.studio === (name === "gate-sorting" ? "gate-sorting" : "paths");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const button of document.querySelectorAll("[data-section]")) {
    button.classList.toggle("active", button.dataset.section === name);
    button.setAttribute("aria-pressed", String(button.dataset.section === name));
  }
  if (name === "paths") showPathStudio(toast);
  else if (name === "sorting") showGraphSorting(toast);
  else showGateSorting(toast);
  history.replaceState(null, "", HASHES[name]);
}

$(".studio-switch").onclick = (event) => {
  const button = event.target.closest("[data-studio]");
  if (button) showStudio(button.dataset.studio === "paths" ? lastPathSection : button.dataset.studio);
};
$(".path-sections").onclick = (event) => {
  const button = event.target.closest("[data-section]");
  if (button) showStudio(button.dataset.section);
};
showStudio(Object.keys(HASHES).find((name) => HASHES[name] === location.hash) ?? "paths");
