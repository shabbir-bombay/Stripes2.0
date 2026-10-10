import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import {
  addPoint,
  createDataset,
  DEFAULT_HEADERS,
  emptyDataset,
  exportCsv,
  formatCoordinate,
  guessMapping,
  parseCoordinate,
  pointStatus,
  readFileData,
  tableFromRows,
  updatePoint,
  validLocation,
} from "./data.js";

const datasetFrom = (rows, headers = DEFAULT_HEADERS) =>
  createDataset(
    { name: "Main", ...tableFromRows([headers, ...rows]) },
    guessMapping(headers),
    "doors.csv",
  );
const csvRows = (dataset) => Papa.parse(exportCsv(dataset).replace(/^\uFEFF/, "")).data;

test("decimal and compass formats have correct signs, axes and bounds", () => {
  assert.equal(parseCoordinate("37.98081° N", "lat"), 37.98081);
  assert.equal(parseCoordinate("121.30852° W", "lng"), -121.30852);
  assert.equal(parseCoordinate("−121.30852", "lng"), -121.30852);
  assert.equal(parseCoordinate("33° 30′ 0″ S", "lat"), -33.5);
  assert.equal(parseCoordinate("0", "lat"), 0);
  for (const value of ["", " ", "NaN", "Infinity", "90.001", "37 E", "37junk", "37° 60′ N"])
    assert.equal(parseCoordinate(value, "lat"), null);
  assert.equal(parseCoordinate("-180", "lng"), -180);
  assert.equal(parseCoordinate("181", "lng"), null);
  assert.equal(validLocation(null, 0), false);
});

test("empty explicit GPS columns fall back to combined pair", () => {
  const dataset = datasetFrom([
    ["Burns Tower", "East", "37.98081° N, 121.30852° W", "", "", "yes"],
  ]);
  assert.equal(dataset.points[0].lat, 37.98081);
  assert.equal(dataset.points[0].lng, -121.30852);
  assert.equal(pointStatus(dataset.points[0]), "original");
  assert.deepEqual(csvRows(dataset)[1], [
    "Burns Tower",
    "East",
    "37.9808100000, -121.3085200000",
    "37.9808100000",
    "-121.3085200000",
    "yes",
  ]);
});

test("explicit coordinates take priority, including equator / prime meridian", () => {
  const dataset = datasetFrom([["Zero", "Gate", "37, -121", "0", "0", ""]]);
  assert.equal(dataset.points[0].lat, 0);
  assert.equal(dataset.points[0].lng, 0);
  assert.equal(csvRows(dataset)[1][3], "0.0000000000");
});

test("partial and invalid explicit coordinates stay in data and block export", () => {
  const dataset = datasetFrom([["Bad", "Gate", "37, -121", "999", "", "no"]]);
  assert.equal(dataset.points.length, 1);
  assert.equal(pointStatus(dataset.points[0]), "invalid");
  assert.throws(() => exportCsv(dataset), /1 point\(s\) need valid coordinates/);
  const fixed = updatePoint(dataset, dataset.points[0].id, { lat: 37, lng: -121 });
  assert.equal(pointStatus(fixed.points[0]), "edited");
  assert.doesNotThrow(() => exportCsv(fixed));
});

test("moving points updates all coordinate columns without touching metadata", () => {
  const dataset = datasetFrom([
    [" Hall, north ", 'Gate "A"\nMain', "37.123456789012, -121.1", "", "", " Yes "],
  ]);
  const moved = updatePoint(dataset, dataset.points[0].id, {
    lat: 37.987654321,
    lng: -121.123456789,
  });
  assert.equal(pointStatus(moved.points[0]), "edited");
  assert.equal(dataset.points[0].lat, 37.123456789012);
  const rows = csvRows(moved);
  assert.equal(rows[1][0], " Hall, north ");
  assert.equal(rows[1][1], 'Gate "A"\nMain');
  assert.equal(rows[1][5], " Yes ");
  assert.equal(rows[1][2], "37.9876543210, -121.1234567890");
});

test("new points are included with a unique identifier and blank custom fields", () => {
  const dataset = datasetFrom(
    [["A", "South", "37,-121", "", "", "yes", "original metadata"]],
    [...DEFAULT_HEADERS, "Notes"],
  );
  const next = addPoint(dataset, 38.1, -122.2);
  assert.equal(next.points.length, 2);
  assert.equal(pointStatus(next.points[1]), "new");
  assert.notEqual(next.points[0].id, next.points[1].id);
  assert.equal(csvRows(next)[2][6], "");
  assert.equal(csvRows(next)[2][3], "38.1000000000");
  assert.equal(csvRows(next)[1][6], "original metadata");
});

test("combined-only imports append Latitude and Longitude and reimport cleanly", async () => {
  const dataset = datasetFrom(
    [["North", "37.123456789, -121.9", "Keep this"]],
    ["Gate Name", "Coordinates", "Notes"],
  );
  const exported = exportCsv(dataset);
  assert.deepEqual(csvRows(dataset)[0], [
    "Gate Name",
    "Coordinates",
    "Notes",
    "Latitude",
    "Longitude",
  ]);
  const [table] = await readFileData(new TextEncoder().encode(exported), "roundtrip.csv");
  const roundtrip = createDataset(table, guessMapping(table.headers), "roundtrip.csv");
  assert.equal(roundtrip.points[0].lat, dataset.points[0].lat);
  assert.equal(roundtrip.points[0].lng, dataset.points[0].lng);
  assert.equal(roundtrip.points[0].cells[2], "Keep this");
});

test("CSV parser handles BOM, quoted commas, Unicode, multiline fields and CRLF", async () => {
  const csv = '\uFEFFName,Latitude,Longitude,Notes\r\n"Entrée, A",37,-121,"Line 1\nLine 2"\r\n';
  const [table] = await readFileData(new TextEncoder().encode(csv), "test.csv");
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0][0], "Entrée, A");
  assert.equal(table.rows[0][3], "Line 1\nLine 2");
});

test("column mapping rejects conflicting fields and missing names/coordinates", () => {
  const table = { name: "Data", headers: ["Name", "Coordinates"], rows: [["A", "37,-121"]] };
  assert.throws(() => createDataset(table, { name: -1, coordinates: 1 }, "a.csv"), /gate name/);
  assert.throws(
    () => createDataset(table, { name: 0, lat: -1, lng: -1, coordinates: -1 }, "a.csv"),
    /latitude and longitude/,
  );
  assert.throws(
    () => createDataset(table, { name: 0, coordinates: 0 }, "a.csv"),
    /different column/,
  );
});

test("blank rows are ignored, but rows with missing coordinates are preserved", () => {
  const table = tableFromRows([
    ["Name", "Latitude", "Longitude"],
    ["A", 37, -121],
    ["", "", ""],
    ["Missing", "", ""],
  ]);
  const dataset = createDataset(table, guessMapping(table.headers), "a.csv");
  assert.equal(dataset.points.length, 2);
  assert.equal(pointStatus(dataset.points[1]), "invalid");
});

test("workbooks support multiple sheets, cached formula values, rich text and precise numbers", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Empty");
  const sheet = workbook.addWorksheet("Gates");
  sheet.addRow(["Name", "Latitude", "Longitude", "Notes"]);
  sheet.addRow([
    "South",
    37.97888608876501,
    -121.3111119635707,
    { richText: [{ text: "Keep " }, { text: "this" }] },
  ]);
  sheet.addRow(["North", { formula: "37+1", result: 38 }, -121, ""]);
  const second = workbook.addWorksheet("Other campus");
  second.addRow(["Name", "Latitude", "Longitude"]);
  second.addRow(["West", 40, -120]);
  const tables = await readFileData(await workbook.xlsx.writeBuffer(), "workbook.xlsx");
  assert.deepEqual(
    tables.map((t) => t.name),
    ["Gates", "Other campus"],
  );
  const dataset = createDataset(tables[0], guessMapping(tables[0].headers), "workbook.xlsx");
  assert.equal(dataset.points[0].lat, 37.97888608876501);
  assert.equal(dataset.points[0].cells[3], "Keep this");
  assert.equal(dataset.points[1].lat, 38);
});

test("exports have ten decimal places even for zeros and tiny values", () => {
  for (const value of [0, 1, -121.9, 0.0000001, 37.12345678901234])
    assert.match(formatCoordinate(value), /^-?\d+\.\d{10}$/);
  assert.equal(csvRows(addPoint(emptyDataset(), 0, 0)).length, 2);
});

test("provided campus workbook imports all 137 points and roundtrips without row loss", async (t) => {
  let buffer;
  try {
    buffer = await fs.readFile(new URL("../public/reference.xlsx", import.meta.url));
  } catch (error) {
    if (error.code === "ENOENT") {
      t.skip("Local reference workbook is not checked into Git.");
      return;
    }
    throw error;
  }
  const [table] = await readFileData(buffer, "Doors GPS Cordinates.xlsx");
  const dataset = createDataset(table, guessMapping(table.headers), "Doors GPS Cordinates.xlsx");
  assert.equal(dataset.points.length, 137);
  assert.equal(dataset.points.filter((p) => !validLocation(p.lat, p.lng)).length, 0);
  const [roundtrip] = await readFileData(
    new TextEncoder().encode(exportCsv(dataset)),
    "updated.csv",
  );
  assert.equal(roundtrip.rows.length, 137);
  for (let i = 0; i < 137; i++) {
    for (const column of [0, 1, 5]) assert.equal(roundtrip.rows[i][column], table.rows[i][column]);
    for (const column of [3, 4]) assert.match(roundtrip.rows[i][column], /^-?\d+\.\d{10}$/);
  }
});
