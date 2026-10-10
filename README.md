# Stripes Campus Studio

A browser tool for preparing the campus map data that Stripes routes on. It has two studios:

- **Path Studio** for the walkway and road graph. It has two sections:
  - **01 Graphing** draws and edits paths.
  - **02 Graph Sorting** sets who may use each path.
- **Gate Studio** marks each building door or gate as accessible or not.

Everything runs in the browser. There is no server and no sign-in. Drafts are saved in this browser's `localStorage`. **Download** is the only durable copy, so download before clearing browser data or switching computers.

```sh
npm install
npm run dev     # http://127.0.0.1:4175
npm test        # unit tests (node --test)
npm run build   # static site in dist/
```

## Hosting

Every push to `Campus-Studio` runs `.github/workflows/pages.yml`. It tests and builds the site, then publishes it to GitHub Pages. The build uses relative paths, so it works at any `https://<user>.github.io/<repo>/` address.

**Saving edits to the repo.** GitHub Pages only serves files and cannot write back. To share edited data:
1. Click **Download** in the studio.
2. Add the file to the repo on github.com with **Add file → Upload files**.

## Path Studio: 01 Graphing

Open at `#paths`.

1. **Download from OSM**, then drag a rectangle on the map (or choose **Whole campus**). Every `highway=*` way in that area is downloaded from Overpass, straight from the browser. An area over 1 MB is refused, so draw a smaller one.
2. **Upload file** loads a graph JSON file. **Download file** saves the current nodes and paths in the same Overpass format.
3. **Edit points:**
   - Select a path to drag its points.
   - Click a **+** between two points to add a point there.
   - A point shared by several paths is a junction and moves in all of them.
   - Shift-click a point to remove it.
   - Edit tags as `key=value` lines.
4. **Add path:** click points on the map, then press Enter or double-click. A click near an existing point joins it. New paths get negative ids and `highway=footway`.
5. **Campus image** lays a picture, such as the printed campus map, over the map to trace from. Move, rotate and resize it with the handles, then **Lock in place**. The image stays in this browser only.

## Path Studio: 02 Graph Sorting

Open at `#paths/sorting`. It works on a separate draft, so Graphing never changes:
- **Copy from Graphing** brings in the current graph.
- **Upload graph** loads a JSON file instead.
- **Download** saves `campus-sorted.json`.

1. Roads start gray (unclassified). Click a road or node and pick any mix of **Small cart**, **Large cart**, **Walk** and **Car**, then **Apply road types**. Each of the 15 combinations has a fixed color.
2. **Color edges (K)** paints one edge at a time with allowed users, path type, ramp, surface or a custom tag. **Insert node (I)** splits an edge.
3. **Fix connectivity:**
   - **Find gaps** lists nearby nodes that should probably connect.
   - Repair them with **Snap node to road**, **Add junction**, **Extend**, **Connect**, **Branch**, **Merge**, or **Delete node / path**.
   - Undo and Redo cover every edit, up to 80 changes.

| Key | Action |
| --- | --- |
| K / I | Toggle edge coloring / insert node |
| J | Add junction |
| M / S | Move node / snap node to road |
| E / C / B / R | Extend / connect / branch / merge |
| N / P | Delete node / delete path (asks first) |
| F / G | Fit graph / find gaps |
| Z / Y | Undo / redo |
| 1 / 2 / 3 / 4 | Toggle small cart / large cart / walk / car |
| A | Apply road types |
| / | Focus road search |
| Esc | Cancel active tool |

Press **?** for the full list. Shortcuts pause while a field has focus.

## Gate Studio

Open at `#gates`.

1. **Upload CSV** loads the gate list from a CSV or Excel file. It needs a name column plus coordinates, given either as latitude and longitude columns or as one `lat, lng` column. If the file has an `Accessible` column, those values are kept.
2. **Classify each gate.** Pick a brush, then click dots or list rows to paint them:
   - **1** Accessible
   - **2** Not accessible
   - **3** Undefined
   - **4** Accessible only on the ground floor
3. **Edit gates & notes (E)** lets you:
   - rename a gate, or set its building and notes;
   - drag a dot, or **Move point (M)**;
   - **Add point (A)**;
   - **Delete point (N)**.
4. **Download CSV** saves `gates-sorted.csv`, with every original column kept and `Accessible` filled in.

## Map styles

Both studios offer **Liberty** (the default), **Bright** and **Satellite**. Path Studio also offers **3D**:
- Liberty and Bright are free OpenFreeMap styles, drawn with MapLibre inside Leaflet.
- 3D is view-only. Switch to another style to edit.
