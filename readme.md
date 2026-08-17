# Parametric Contour Lines Generator
![example](https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Contour2D.svg/1024px-Contour2D.svg.png)

The purpose of this project is to generate **parametric [contour lines](https://en.wikipedia.org/wiki/Contour_line)** and export them as beautiful SVGs.

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
| [color.js](js/color.js) | Palettes and sampling (elevation ramp / cycle / single) |
| [url.js](js/url.js) | State <-> query string; the URL is the save format |
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
- **Palettes.** *Topographic* and *Paper white* are fixed lists; *Rainbow* and *Single colour* are
  generated (hue wheel, and lightness steps of a picked colour). A palette supplies either `colors` or a
  `build(style)` function, so adding a generated one takes a single entry in `PALETTES`.

By default colour is a continuous **ramp** across the palette, so it encodes elevation. *Cycle* repeats
the palette per line and *single* uses one colour throughout.

## Adding a parameter

Add the field to `createDefaultState()` in [state.js](js/state.js), then one entry to `SCHEMA` in
[controls.js](js/controls.js) with its `path`. The panel and the render loop pick it up automatically.

A control can bind to a state `path`, or to an explicit `get`/`set` pair when the target is not a fixed
location — that is how the selected-point sliders reach whichever point is currently selected. Groups and
individual controls both accept a `visible(state)` predicate.
