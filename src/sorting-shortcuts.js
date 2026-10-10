export const SORTING_SHORTCUTS = [
  { key: "k", label: "Toggle edge Coloring mode", selector: "#sorting-color-mode" },
  { key: "i", label: "Insert node on an edge", selector: "#sorting-insert-mode" },
  { key: "j", label: "Add junction", selector: "#sorting-junction" },
  { key: "m", label: "Move node", selector: '[data-operation="move"]' },
  { key: "s", label: "Snap node to road", selector: '[data-operation="snap"]' },
  { key: "e", label: "Extend road", selector: '[data-operation="extend"]' },
  { key: "c", label: "Connect nodes", selector: '[data-operation="connect"]' },
  { key: "b", label: "Branch to road", selector: '[data-operation="branch"]' },
  { key: "r", label: "Merge nodes", selector: '[data-operation="merge"]' },
  { key: "n", label: "Delete node (confirmation)", selector: "#sorting-delete-node" },
  { key: "p", label: "Delete path (confirmation)", selector: "#sorting-delete-path" },
  { key: "f", label: "Fit graph", selector: "#sorting-fit" },
  { key: "g", label: "Find gaps", selector: "#sorting-find-gaps" },
  { key: "z", label: "Undo", selector: "#sorting-undo" },
  { key: "y", label: "Redo", selector: "#sorting-redo" },
  { key: "1", label: "Toggle Small cart", selector: 'input[name="roadType"][value="small_cart"]' },
  { key: "2", label: "Toggle Large cart", selector: 'input[name="roadType"][value="large_cart"]' },
  { key: "3", label: "Toggle Walk", selector: 'input[name="roadType"][value="walk"]' },
  { key: "4", label: "Toggle Car", selector: 'input[name="roadType"][value="car"]' },
  { key: "a", label: "Apply road types", selector: '#sorting-editor button[type="submit"]' },
  { key: "/", label: "Focus road search", selector: "#sorting-search" },
  { key: "?", label: "Keyboard shortcuts", selector: "#sorting-shortcuts" },
  { key: "Escape", label: "Cancel active tool" },
];

export function isEditingField(element) {
  return Boolean(element?.isContentEditable || element?.closest?.('input, textarea, select, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable]:not([contenteditable="false"])'));
}

/** Leave native typing, composition, controls, browser shortcuts and dialogs alone. */
export function sortingShortcut(event, { activeElement, studio, dialogOpen, busy = false, viewOnly = false }) {
  if (studio !== "sorting" || dialogOpen || busy || viewOnly || event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229) return null;
  if ([activeElement, event.target, ...(event.composedPath?.() ?? [])].some(isEditingField)) return null;
  const key = event.key?.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "z") return event.shiftKey ? "y" : "z";
  if (event.ctrlKey || event.metaKey || event.altKey || (event.shiftKey && event.key !== "?")) return null;
  return SORTING_SHORTCUTS.find((shortcut) => shortcut.key === (event.key === "Escape" ? "Escape" : key))?.key ?? null;
}
