import Papa from "papaparse";
import ExcelJS from "exceljs";

export const DEFAULT_HEADERS = [
  "Building Name",
  "Door Name",
  "Coordinates",
  "Latitude",
  "Longitude",
  "Accessible",
];
export const formatCoordinate = (value) => Number(value).toFixed(10);
export const validLocation = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function parseCoordinate(value, axis) {
  const text = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/−/g, "-");
  if (!text) return null;
  const match = text.match(
    /^([+-]?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?([NSEW])?$/,
  );
  if (!match) return null;
  const [, degrees, minutes, seconds, direction] = match;
  if (
    (axis === "lat" && /[EW]/.test(direction ?? "")) ||
    (axis === "lng" && /[NS]/.test(direction ?? ""))
  )
    return null;
  if (Number(minutes ?? 0) >= 60 || Number(seconds ?? 0) >= 60) return null;
  let number = Math.abs(Number(degrees)) + Number(minutes ?? 0) / 60 + Number(seconds ?? 0) / 3600;
  number *= direction ? (/[SW]/.test(direction) ? -1 : 1) : Number(degrees) < 0 ? -1 : 1;
  return Math.abs(number) <= (axis === "lat" ? 90 : 180) ? number : null;
}

export function guessMapping(headers) {
  const find = (names) =>
    headers.findIndex((h) => names.includes(h.toLowerCase().replace(/[^a-z0-9]/g, "")));
  return {
    building: find(["buildingname", "building", "site", "locationname"]),
    name: find(["doorname", "gatename", "name", "gate", "door", "label", "pointname"]),
    lat: find(["latitude", "lat", "gpslatitude"]),
    lng: find(["longitude", "lng", "lon", "long", "gpslongitude"]),
    coordinates: find([
      "coordinates",
      "coordinate",
      "gpscoordinates",
      "gpscordinates",
      "coords",
      "gps",
    ]),
    accessible: find(["accessible", "accessibility", "ada"]),
  };
}

export function tableFromRows(rows) {
  const nonempty = rows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (nonempty.length < 2) throw new Error("This file needs a header row and at least one point.");
  const width = nonempty.reduce((max, row) => Math.max(max, row.length), 0);
  const headers = Array.from(
    { length: width },
    (_, i) => String(nonempty[0][i] ?? "").trim() || `Column ${i + 1}`,
  );
  return {
    headers,
    rows: nonempty.slice(1).map((row) => headers.map((_, i) => String(row[i] ?? ""))),
  };
}

export async function readFileData(buffer, filename) {
  if (/\.csv$/i.test(filename)) {
    const parsed = Papa.parse(new TextDecoder().decode(buffer).replace(/^\uFEFF/, ""), {
      skipEmptyLines: "greedy",
    });
    if (parsed.errors.length) throw new Error(`Could not read CSV: ${parsed.errors[0].message}`);
    return [{ name: "CSV", ...tableFromRows(parsed.data) }];
  }
  if (!/\.xlsx$/i.test(filename)) throw new Error("Choose a CSV or XLSX file.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const tables = [];
  const cellValue = (value) => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "object") return String(value);
    if ("formula" in value || "sharedFormula" in value) return cellValue(value.result);
    if (value.richText) return value.richText.map((part) => part.text).join("");
    return String(value.text ?? value.error ?? "");
  };
  workbook.eachSheet((sheet) => {
    const rows = [];
    sheet.eachRow((row) =>
      rows.push(
        Array.from({ length: row.cellCount }, (_, index) =>
          cellValue(row.getCell(index + 1).value),
        ),
      ),
    );
    if (rows.filter((row) => row.some((cell) => String(cell).trim())).length >= 2)
      tables.push({ name: sheet.name, ...tableFromRows(rows) });
  });
  if (!tables.length) throw new Error("No worksheet contains a header and point data.");
  return tables;
}

export function createDataset(table, mapping, filename) {
  if (mapping.name < 0) throw new Error("Choose a column for the door / gate name.");
  if (mapping.coordinates < 0 && (mapping.lat < 0 || mapping.lng < 0))
    throw new Error("Choose latitude and longitude columns, or a combined coordinates column.");
  const assigned = Object.values(mapping).filter((index) => index >= 0);
  if (new Set(assigned).size !== assigned.length)
    throw new Error("Each field must use a different column.");
  return {
    filename,
    sheet: table.name,
    headers: table.headers,
    mapping,
    points: table.rows.map((cells, index) => {
      let lat = parseCoordinate(cells[mapping.lat], "lat");
      let lng = parseCoordinate(cells[mapping.lng], "lng");
      // A partially filled/invalid explicit pair needs review; do not quietly replace it.
      if (!String(cells[mapping.lat] ?? "").trim() && !String(cells[mapping.lng] ?? "").trim()) {
        const pair = String(cells[mapping.coordinates] ?? "").split(/[,;]/);
        if (pair.length === 2) {
          lat = parseCoordinate(pair[0], "lat");
          lng = parseCoordinate(pair[1], "lng");
        }
      }
      return { id: `import-${index}`, cells, lat, lng, original: { cells: [...cells], lat, lng } };
    }),
  };
}

export function emptyDataset() {
  return {
    filename: "gates.csv",
    sheet: "New dataset",
    headers: [...DEFAULT_HEADERS],
    mapping: guessMapping(DEFAULT_HEADERS),
    points: [],
  };
}

export function pointStatus(point) {
  if (!validLocation(point.lat, point.lng)) return "invalid";
  if (!point.original) return "new";
  return point.lat !== point.original.lat ||
    point.lng !== point.original.lng ||
    point.cells.some((cell, i) => cell !== point.original.cells[i])
    ? "edited"
    : "original";
}

export function pointName(point, mapping) {
  return (
    [point.cells[mapping.building]?.trim(), point.cells[mapping.name]?.trim()]
      .filter(Boolean)
      .join(" · ") || "Unnamed point"
  );
}

export function updatePoint(dataset, id, changes) {
  return {
    ...dataset,
    points: dataset.points.map((point) => (point.id === id ? { ...point, ...changes } : point)),
  };
}

export function addPoint(dataset, lat, lng) {
  const cells = dataset.headers.map(() => "");
  let number = dataset.points.length + 1;
  while (dataset.points.some((p) => p.cells[dataset.mapping.name] === `New gate ${number}`))
    number++;
  cells[dataset.mapping.name] = `New gate ${number}`;
  const point = { id: crypto.randomUUID(), cells, lat, lng, original: null };
  return { ...dataset, points: [...dataset.points, point] };
}

export function exportCsv(dataset) {
  const invalid = dataset.points.filter((p) => !validLocation(p.lat, p.lng));
  if (invalid.length)
    throw new Error(
      `${invalid.length} point(s) need valid coordinates before export. Use the “Needs location” filter to fix them.`,
    );
  const headers = [...dataset.headers];
  let latIndex = dataset.mapping.lat,
    lngIndex = dataset.mapping.lng;
  if (latIndex < 0) {
    latIndex = headers.length;
    headers.push("Latitude");
  }
  if (lngIndex < 0) {
    lngIndex = headers.length;
    headers.push("Longitude");
  }
  const rows = dataset.points.map((point) => {
    const cells = headers.map((_, i) => point.cells[i] ?? "");
    cells[latIndex] = formatCoordinate(point.lat);
    cells[lngIndex] = formatCoordinate(point.lng);
    if (dataset.mapping.coordinates >= 0)
      cells[dataset.mapping.coordinates] = `${cells[latIndex]}, ${cells[lngIndex]}`;
    return cells;
  });
  return "\uFEFF" + Papa.unparse([headers, ...rows], { newline: "\r\n" });
}
