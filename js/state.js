/**
 * Application state: a single plain object plus a change notification.
 *
 * Everything downstream (field, contours, SVG) is derived from this, so the
 * render pipeline stays a pure function of state and any control can simply
 * mutate a value and call `emit`.
 */

import { createView } from './viewport.js';

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
