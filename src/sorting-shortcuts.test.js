import test from "node:test";
import assert from "node:assert/strict";
import { SORTING_SHORTCUTS, isEditingField, sortingShortcut } from "./sorting-shortcuts.js";

const context = { studio: "sorting", dialogOpen: false, activeElement: null };
const key = (value, extra = {}, state = {}) => sortingShortcut({ key: value, ...extra }, { ...context, ...state });

test("all advertised single keys resolve, without requiring modifier keys", () => {
  assert.equal(new Set(SORTING_SHORTCUTS.map((s) => s.key)).size, SORTING_SHORTCUTS.length);
  for (const shortcut of SORTING_SHORTCUTS) assert.equal(key(shortcut.key), shortcut.key);
  assert.equal(key("M"), "m", "Caps Lock works");
  assert.equal(key("?", { shiftKey: true }), "?");
  assert.equal(key("q"), null);
});

test("active fields, event targets and editable shadow paths disable every shortcut including Escape and undo", () => {
  const field = { closest: () => ({ tagName: "INPUT" }) };
  for (const value of [...SORTING_SHORTCUTS.map((s) => s.key), "Z"]) {
    assert.equal(key(value, {}, { activeElement: field }), null);
    assert.equal(key(value, { target: field }), null);
    assert.equal(key(value, { composedPath: () => [field] }), null);
  }
  assert.equal(key("z", { ctrlKey: true }, { activeElement: field }), null);
  assert.equal(key("z", { metaKey: true, shiftKey: true }, { activeElement: field }), null);
  assert.equal(isEditingField({ isContentEditable: true }), true);
  assert.equal(isEditingField({ closest: () => null }), false);
  assert.equal(isEditingField(null), false);
});

test("dialogs, other studios, 3D view and busy operations never trigger editor shortcuts", () => {
  for (const state of [{ studio: "gates" }, { studio: "paths" }, { dialogOpen: true }, { busy: true }, { viewOnly: true }])
    for (const shortcut of SORTING_SHORTCUTS) assert.equal(key(shortcut.key, {}, state), null);
});

test("typing composition, held keys, handled events and browser shortcuts are ignored", () => {
  for (const extra of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { defaultPrevented: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }])
    assert.equal(key("m", extra), null);
  assert.equal(key("z", { ctrlKey: true, altKey: true }), null, "AltGr stays native");
  assert.equal(key("Dead"), null);
});

test("existing command/control undo and redo remain available outside fields", () => {
  assert.equal(key("z", { ctrlKey: true }), "z");
  assert.equal(key("z", { metaKey: true }), "z");
  assert.equal(key("Z", { ctrlKey: true, shiftKey: true }), "y");
  assert.equal(key("z", { metaKey: true, shiftKey: true }), "y");
});
