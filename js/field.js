/**
 * Scalar field construction.
 *
 * Contour lines are level sets of a continuous height function h(x, y).
 * The user only gives us scattered samples, so we reconstruct h on a regular
 * grid by interpolation, then let marching squares slice it.
 *
 * All coordinates here are normalised to [0, 1] x [0, 1]; pixel mapping is the
 * renderer's job.
 */

import { fbm } from './noise.js';

/** Inverse-distance weighting (Shepard). Smooth, cheap, no matrix solve. */
function idw(px, py, points, power, epsilon) {
    let num = 0;
    let den = 0;

    for (const p of points) {
        const dx = px - p.x;
        const dy = py - p.y;
        const d2 = dx * dx + dy * dy + epsilon;
        const w = 1 / Math.pow(d2, power / 2);
        num += w * p.z;
        den += w;
    }

    return den === 0 ? 0 : num / den;
}

/** Gaussian radial basis blending — each point is a bump of the given radius. */
function gaussian(px, py, points, radius) {
    const denomScale = 2 * radius * radius;
    let num = 0;
    let den = 0;

    for (const p of points) {
        const dx = px - p.x;
        const dy = py - p.y;
        const w = Math.exp(-(dx * dx + dy * dy) / denomScale);
        num += w * p.z;
        den += w;
    }

    return den === 0 ? 0 : num / den;
}

/**
 * Additive gaussian bumps: heights sum instead of averaging, so overlapping
 * points build ridges. This is the one that looks most like real terrain.
 */
function bumps(px, py, points, radius) {
    const denomScale = 2 * radius * radius;
    let sum = 0;

    for (const p of points) {
        const dx = px - p.x;
        const dy = py - p.y;
        sum += p.z * Math.exp(-(dx * dx + dy * dy) / denomScale);
    }

    return sum;
}

export const MASK_SHAPES = {
    radial: 'Island (oval)',
    frame: 'Island (rectangular)',
    none: 'None — run off edge',
};

/** Cubic smoothstep. */
function smoothstep(t) {
    const c = Math.min(1, Math.max(0, t));
    return c * c * (3 - 2 * c);
}

/**
 * Smooth mask that pulls the field down to zero near the canvas border, so
 * every contour closes inside the frame (island look) instead of being clipped.
 *
 * `radial` fades along an ellipse, which reads as a natural landmass; `frame`
 * fades toward the four straight sides, which produces contours parallel to
 * the border — a deliberate, more graphic look.
 */
function edgeMask(px, py, falloff, shape) {
    if (falloff <= 0 || shape === 'none') return 1;

    if (shape === 'frame') {
        const d = Math.min(px, py, 1 - px, 1 - py);
        return smoothstep(d / falloff);
    }

    // radial: r is 0 at the centre and 1 at the edge midpoints.
    const r = Math.hypot((px - 0.5) * 2, (py - 0.5) * 2);
    return smoothstep((1 - r) / falloff);
}

export const INTERPOLATION_METHODS = {
    bumps: 'Additive bumps',
    idw: 'Inverse distance',
    gaussian: 'Gaussian blend',
};

/**
 * A sampled height field.
 * `data` is row-major, (cols x rows) samples covering [0,1]^2 inclusive.
 */
export class Field {
    constructor(cols, rows, data, min, max) {
        this.cols = cols;
        this.rows = rows;
        this.data = data;
        this.min = min;
        this.max = max;
    }

    at(ix, iy) {
        return this.data[iy * this.cols + ix];
    }

    /** Normalised [0,1] position of a grid node. */
    gridX(ix) {
        return ix / (this.cols - 1);
    }

    gridY(iy) {
        return iy / (this.rows - 1);
    }
}

/**
 * Build the height field from control points.
 *
 * @param {Array<{x:number,y:number,z:number}>} points normalised control points
 * @param {object} options field settings
 * @returns {Field}
 */
export function buildField(points, options) {
    const {
        resolution = 160,
        method = 'bumps',
        power = 2,
        radius = 0.25,
        noiseAmount = 0,
        noiseScale = 3,
        noiseOctaves = 4,
        seed = 1,
        edgeFalloff = 0,
        maskShape = 'radial',
        normalize = true,
    } = options;

    const cols = Math.max(2, Math.round(resolution));
    const rows = Math.max(2, Math.round(resolution));
    const data = new Float32Array(cols * rows);

    let min = Infinity;
    let max = -Infinity;

    for (let iy = 0; iy < rows; iy++) {
        const py = iy / (rows - 1);

        for (let ix = 0; ix < cols; ix++) {
            const px = ix / (cols - 1);

            let h;
            if (points.length === 0) {
                h = 0;
            } else if (method === 'idw') {
                h = idw(px, py, points, power, 1e-6);
            } else if (method === 'gaussian') {
                h = gaussian(px, py, points, radius);
            } else {
                h = bumps(px, py, points, radius);
            }

            if (noiseAmount > 0) {
                h += noiseAmount * fbm(px, py, {
                    frequency: noiseScale,
                    octaves: noiseOctaves,
                    seed,
                });
            }

            h *= edgeMask(px, py, edgeFalloff, maskShape);

            data[iy * cols + ix] = h;
            if (h < min) min = h;
            if (h > max) max = h;
        }
    }

    if (normalize && max > min) {
        const span = max - min;
        for (let i = 0; i < data.length; i++) {
            data[i] = (data[i] - min) / span;
        }
        min = 0;
        max = 1;
    }

    return new Field(cols, rows, data, min, max);
}

/**
 * Evenly spaced contour levels, excluding the exact extremes where the level
 * set degenerates to a point or the whole frame.
 */
export function contourLevels(field, count) {
    const n = Math.max(1, Math.round(count));
    const levels = [];
    const span = field.max - field.min;

    for (let i = 1; i <= n; i++) {
        levels.push(field.min + (span * i) / (n + 1));
    }

    return levels;
}
