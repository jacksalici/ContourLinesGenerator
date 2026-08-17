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
| [noise.js](web/js/noise.js) | Seeded value noise and fBm, for natural-looking terrain |
| [field.js](web/js/field.js) | Interpolates control points into a height grid; border masks |
| [marching-squares.js](web/js/marching-squares.js) | Extracts one level set as stitched polylines |
| [path.js](web/js/path.js) | Simplification, Chaikin smoothing, SVG path data |
| [color.js](web/js/color.js) | Palette sampling (elevation ramp / cycle / single) |
| [renderer.js](web/js/renderer.js) | State → drawing; mounts to DOM and serialises to file |
| [state.js](web/js/state.js) | State shape, palettes, tiny observable store |
| [controls.js](web/js/controls.js) | Control panel, generated from a declarative schema |
| [points-layer.js](web/js/points-layer.js) | Interactive control-point handles |

Two details worth knowing:

- **Interpolation methods.** *Additive bumps* sums gaussians so overlapping points build ridges (most
  terrain-like); *inverse distance* and *gaussian blend* average instead, so the field never exceeds the
  highest control point.
- **Border mask.** The field is faded to zero near the frame so contours close into islands instead of
  being clipped. `radial` gives an oval landmass, `frame` gives rings parallel to the border, `none`
  lets lines run off the edge.

## Editing

- **Click** empty canvas to add a point
- **Drag** to move, **Shift+drag** or **scroll** over a handle to change its height
- **Alt+click** or **right click** to delete
- **Save/Load preset** round-trips the whole parameter set as JSON

Control points are stored in normalised `[0,1]` coordinates, so changing the canvas size never moves them.

## Adding a parameter

Add the field to `createDefaultState()` in [state.js](web/js/state.js), then one entry to `SCHEMA` in
[controls.js](web/js/controls.js) with its `path`. The panel and the render loop pick it up automatically.

## Legacy

`app.py`, `geometry.py` and `canvas.py` are the original Python prototype. Note that its contour step
took the *convex hull* of the points at each height, which cannot produce real contour lines — they are
almost never convex. The web app replaces that with marching squares.
