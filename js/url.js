/**
 * State <-> URL query string.
 *
 * The address bar is the save format: every parameter and control point round
 * trips through it, so sharing a link shares the exact drawing.
 *
 * Two things keep the URL short enough to be usable: only values that differ
 * from the defaults are written, and numbers are rounded before encoding.
 */

import { createDefaultState } from './state.js';

/**
 * Query key, state path, type, and the accepted range.
 *
 * URLs are hand-editable and shared, so numeric bounds are enforced here as
 * well as in the panel — an out-of-range `res` would otherwise ask for a grid
 * big enough to hang the tab.
 */
const PARAMS = [
    { key: 'w', path: 'canvas.width', type: 'int', min: 100, max: 5000 },
    { key: 'h', path: 'canvas.height', type: 'int', min: 100, max: 5000 },
    { key: 'pad', path: 'canvas.padding', type: 'int', min: 0, max: 300 },

    { key: 'met', path: 'field.method', type: 'str' },
    { key: 'res', path: 'field.resolution', type: 'int', min: 30, max: 500 },
    { key: 'pow', path: 'field.power', type: 'num', min: 0.5, max: 8 },
    { key: 'rad', path: 'field.radius', type: 'num', min: 0.02, max: 1 },
    { key: 'na', path: 'field.noiseAmount', type: 'num', min: 0, max: 1.5 },
    { key: 'nsc', path: 'field.noiseScale', type: 'num', min: 0.5, max: 12 },
    { key: 'noc', path: 'field.noiseOctaves', type: 'int', min: 1, max: 8 },
    { key: 'sd', path: 'field.seed', type: 'int', min: 0, max: 99999 },
    { key: 'ef', path: 'field.edgeFalloff', type: 'num', min: 0.01, max: 1 },
    { key: 'msk', path: 'field.maskShape', type: 'str' },

    { key: 'n', path: 'contours.count', type: 'int', min: 1, max: 120 },
    { key: 'sm', path: 'contours.smoothing', type: 'int', min: 0, max: 6 },
    { key: 'sim', path: 'contours.simplifyTolerance', type: 'num', min: 0, max: 0.01 },
    { key: 'ml', path: 'contours.minLength', type: 'int', min: 2, max: 60 },

    { key: 'pal', path: 'style.palette', type: 'str' },
    { key: 'cm', path: 'style.colorMode', type: 'str' },
    { key: 'bc', path: 'style.baseColor', type: 'color' },
    { key: 'sw', path: 'style.strokeWidth', type: 'num', min: 0.0, max: 8 },
    { key: 'swr', path: 'style.strokeWidthStep', type: 'num', min: -0.2, max: 0.2 },
    { key: 'fil', path: 'style.fill', type: 'bool' },
    { key: 'fo', path: 'style.fillOpacity', type: 'num', min: 0, max: 1 },
];

const MAX_POINTS = 400;

const POINTS_KEY = 'p';

function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((acc, key) => acc[key], obj)[last] = value;
}

/** Round to at most 4 decimals and drop trailing zeros. */
function short(n) {
    return String(Number(Number(n).toFixed(4)));
}

function encodeValue(value, type) {
    if (type === 'bool') return value ? '1' : '0';
    if (type === 'color') return String(value).replace('#', '');
    if (type === 'str') return String(value);
    return short(value);
}

function decodeValue(raw, { type, min, max }) {
    if (raw === '') return null; // an empty param is a typo, not a zero

    if (type === 'bool') return raw === '1' || raw === 'true';
    if (type === 'color') return /^#?[0-9a-f]{6}$/i.test(raw) ? `#${raw.replace('#', '')}` : null;
    if (type === 'str') return raw;

    let n = Number(raw);
    if (!Number.isFinite(n)) return null;

    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);

    return type === 'int' ? Math.round(n) : n;
}

/** Points as `x,y,z;x,y,z` — 3 decimals is well under one pixel at any sane size. */
function encodePoints(points) {
    return points
        .map((p) => [p.x, p.y, p.z].map((v) => Number(v).toFixed(3)).join(','))
        .join(';');
}

function decodePoints(raw) {
    return raw
        .split(';')
        .map((chunk) => chunk.split(',').map(Number))
        .filter((parts) => parts.length === 3 && parts.every(Number.isFinite))
        .slice(0, MAX_POINTS)
        .map(([x, y, z]) => ({ x, y, z }));
}

/**
 * Encode state as a query string (no leading '?').
 * Values equal to the default are omitted.
 */
export function encodeState(state) {
    const defaults = createDefaultState();
    const parts = [];

    for (const { key, path, type } of PARAMS) {
        const value = getPath(state, path);
        if (value === undefined || value === null) continue;

        const encoded = encodeValue(value, type);
        if (encoded === encodeValue(getPath(defaults, path), type)) continue;

        parts.push(`${key}=${encodeURIComponent(encoded)}`);
    }

    if (state.points.length) {
        // Commas and semicolons are legal in a query, so leave them readable.
        parts.push(`${POINTS_KEY}=${encodePoints(state.points)}`);
    }

    return parts.join('&');
}

/**
 * Apply a query string onto a state object, in place.
 * Unknown keys and malformed values are ignored, so an edited URL degrades
 * to the defaults rather than breaking the page.
 *
 * @returns {boolean} whether anything was applied
 */
export function applyQuery(state, search, createPoint) {
    const params = new URLSearchParams(search);
    let applied = false;

    for (const param of PARAMS) {
        if (!params.has(param.key)) continue;

        const value = decodeValue(params.get(param.key), param);
        if (value === null) continue;

        setPath(state, param.path, value);
        applied = true;
    }

    if (params.has(POINTS_KEY)) {
        const points = decodePoints(params.get(POINTS_KEY));
        state.points = points.map((p) => createPoint(p.x, p.y, p.z));
        applied = true;
    }

    return applied;
}

/** Current page URL carrying the given state. */
export function stateURL(state) {
    const query = encodeState(state);
    return `${location.origin}${location.pathname}${query ? `?${query}` : ''}`;
}
