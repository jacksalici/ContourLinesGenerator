/**
 * Application state: a single plain object plus a change notification.
 *
 * Everything downstream (field, contours, SVG) is derived from this, so the
 * render pipeline stays a pure function of state and any control can simply
 * mutate a value and call `emit`.
 */

import { createView } from './viewport.js';
import { PALETTES, hslToHex } from './color.js';

export function createDefaultState() {
    return {
        canvas: {
            width: 900,
            height: 900,
            padding: 0,
        },
        field: {
            method: 'bumps',
            resolution: 220,
            power: 2,
            radius: 0.15,
            noiseAmount: 0.35,
            noiseScale: 2.5,
            noiseOctaves: 5,
            seed: 7,
            edgeFalloff: 0.45,
            maskShape: 'radial',
        },
        contours: {
            count: 22,
            smoothing: 3,
            simplifyTolerance: 0.0015,
            minLength: 4,
        },
        style: {
            palette: 'topo',
            colorMode: 'ramp',
            baseColor: '#2f7fd0', // used by the single-colour palette
            background: null, // null = use the palette's background
            strokeWidth: 1.4,
            strokeWidthStep: 0,
            fill: false,
            fillOpacity: 0.08,
            precision: 2,
        },
        points: [],
        view: createView(),
        ui: {
            showPoints: true,
            showField: false,
            selectedId: null,
        },
    };
}

/** The currently selected control point, or null. */
export function selectedPoint(state) {
    if (state.ui.selectedId === null) return null;
    return state.points.find((p) => p.id === state.ui.selectedId) || null;
}

/** Minimal observable wrapper so the UI and renderer stay decoupled. */
export class Store {
    constructor(state) {
        this.state = state;
        this._listeners = new Set();
    }

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    emit() {
        for (const listener of this._listeners) listener(this.state);
    }

    /** Mutate via a callback, then notify. */
    update(mutator) {
        mutator(this.state);
        this.emit();
    }
}

let nextPointId = 1;

export function createPoint(x, y, z = 0.7) {
    return { id: nextPointId++, x, y, z };
}

/** Scatter random control points, biased away from the very edge. */
export function randomPoints(count, random, inset = 0.08) {
    const points = [];
    const span = 1 - inset * 2;

    for (let i = 0; i < count; i++) {
        points.push(createPoint(
            inset + random() * span,
            inset + random() * span,
            0.35 + random() * 0.65,
        ));
    }

    return points;
}

/**
 * Randomise the whole look of a drawing, in place.
 *
 * The ranges are deliberately narrower than the sliders allow: every draw
 * should be a plausible piece of terrain, so this explores the space that
 * looks good rather than the space that is merely valid. Options are weighted
 * by repeating them in the pick lists.
 *
 * Canvas size and grid resolution are left alone — they are decisions about
 * the output, not about how the drawing looks.
 */
export function randomizeConfig(state, random) {
    const pick = (options) => options[Math.floor(random() * options.length)];
    const range = (min, max) => min + random() * (max - min);

    state.field.seed = Math.floor(random() * 10000);
    state.field.method = pick(['bumps', 'bumps', 'bumps', 'gaussian', 'idw']);
    state.field.radius = range(0.1, 0.28);
    state.field.power = range(1.5, 4);
    state.field.maskShape = pick(['radial', 'radial', 'radial', 'frame', 'none']);
    state.field.edgeFalloff = range(0.25, 0.7);
    state.field.noiseAmount = range(0.15, 0.6);
    state.field.noiseScale = range(1.5, 5);
    state.field.noiseOctaves = Math.round(range(3, 6));

    state.contours.count = Math.round(range(12, 45));
    state.contours.smoothing = Math.round(range(2, 4));

    state.style.palette = pick(Object.keys(PALETTES));
    state.style.colorMode = pick(['ramp', 'ramp', 'ramp', 'cycle']);
    state.style.baseColor = hslToHex(random() * 360, range(0.45, 0.75), range(0.35, 0.5));
    state.style.strokeWidth = range(0.8, 2.2);
    state.style.fill = random() < 0.25;

    // Nested contours stack, so N fills at opacity a read as 1-(1-a)^N. Solve
    // back from the total we actually want, or a busy drawing turns into an
    // opaque blob with the line work buried under it.
    const totalFill = range(0.35, 0.6);
    state.style.fillOpacity = 1 - Math.pow(1 - totalFill, 1 / state.contours.count);

    state.points = randomPoints(Math.round(range(5, 14)), random);
    state.ui.selectedId = null;

    return state;
}
