# Curve Generator
![example](https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Contour2D.svg/1024px-Contour2D.svg.png)

The purpose of this project is to generate **parametric [contour lines](https://en.wikipedia.org/wiki/Contour_line)** and export them as beautiful SVGs.

What do I intend as parametric? Basically the curves will be generated from a set of points or functions.

## Running

No build step, no dependencies. Serve the folder (ES modules need HTTP, `file://` will not work):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## How it works

Contour lines are level sets of a continuous height function `h(x, y)`. The user only supplies scattered
control points, so the pipeline reconstructs the surface first and slices it second:

```
control points  →  scalar field  →  marching squares  →  stitching  →  simplify + smooth  →  SVG paths
   (x, y, z)        regular grid      cell crossings      polylines      Douglas-Peucker
                                                                         + Chaikin
```

| Module | Responsibility |
| --- | --- |
| [noise.js](js/noise.js) | Seeded value noise and fBm, for natural-looking terrain |
| [field.js](js/field.js) | Interpolates control points into a height grid; border masks |
| [marching-squares.js](js/marching-squares.js) | Extracts one level set as stitched polylines |
| [path.js](js/path.js) | Simplification, Chaikin smoothing, SVG path data |
| [color.js](js/color.js) | Palette sampling (elevation ramp / cycle / single) |
| [renderer.js](js/renderer.js) | State → drawing; mounts to DOM and serialises to file |
| [state.js](js/state.js) | State shape, palettes, tiny observable store |
| [controls.js](js/controls.js) | Control panel, generated from a declarative schema |
| [points-layer.js](js/points-layer.js) | Interactive control-point handles, selection, zoom/pan input |
| [viewport.js](js/viewport.js) | Zoom and pan, applied through the SVG viewBox |
| [main.js](js/main.js) | Wiring: store → render loop → DOM |

The page has no stylesheet: the handful of rules it needs are inlined in [index.html](index.html).

Two details worth knowing:

- **Interpolation methods.** *Additive bumps* sums gaussians so overlapping points build ridges (most
  terrain-like); *inverse distance* and *gaussian blend* average instead, so the field never exceeds the
  highest control point.
- **Border mask.** The field is faded to zero near the frame so contours close into islands instead of
  being clipped. `radial` gives an oval landmass, `frame` gives rings parallel to the border, `none`
  lets lines run off the edge.

## Editing

- **Click** empty canvas to add a point; **click** a point to select it
- **Drag** a point to move it, **Shift+drag** or **scroll** over it to change its height
- **Alt+click** or **right click** a point to delete it
- A selected point also gets X / Y / Height sliders at the top of the sidebar
- **Save/Load preset** round-trips the whole parameter set as JSON

Control points are stored in normalised `[0,1]` coordinates, so changing the canvas size never moves them.

## Navigating

**Scroll** to zoom about the cursor, **drag** empty canvas to pan, or use the zoom buttons. Zoom is applied
through the SVG `viewBox`, so it is purely a view concern: coordinates stay in canvas space and the
exported SVG always covers the full canvas whatever you are looking at.

## Adding a parameter

Add the field to `createDefaultState()` in [state.js](js/state.js), then one entry to `SCHEMA` in
[controls.js](js/controls.js) with its `path`. The panel and the render loop pick it up automatically.

A control can bind to a state `path`, or to an explicit `get`/`set` pair when the target is not a fixed
location — that is how the selected-point sliders reach whichever point is currently selected. Groups and
individual controls both accept a `visible(state)` predicate.

## Legacy

The original Python prototype (`app.py`, `geometry.py`, `canvas.py`) took the *convex hull* of the points
at each height, which cannot produce real contour lines — they are almost never convex. Marching squares
replaces it.
