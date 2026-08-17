/**
 * Application state: a single plain object plus a change notification.
 *
 * Everything downstream (field, contours, SVG) is derived from this, so the
 * render pipeline stays a pure function of state and any control can simply
 * mutate a value and call `emit`.
 */

export const PALETTES = {
    ink: { name: 'Ink', background: '#f5f1e8', colors: ['#1b1b1b'] },
    topo: { name: 'Topographic', background: '#fdf6e3', colors: ['#6b4f2a', '#8a6a3b', '#a9854c', '#c6a06a'] },
    ocean: { name: 'Ocean', background: '#06182b', colors: ['#3fa7d6', '#59c3e0', '#8ad9e8', '#c2eef5'] },
    ember: { name: 'Ember', background: '#150c0c', colors: ['#5a1e1e', '#a33a1f', '#dd6b20', '#f2b134'] },
    moss: { name: 'Moss', background: '#0f1a12', colors: ['#2f5d3a', '#4a8055', '#79a86f', '#b6cf9b'] },
    mono: { name: 'Paper white', background: '#ffffff', colors: ['#2b2b2b', '#555555', '#808080'] },
};

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
            background: null, // null = use the palette's background
            strokeWidth: 1.4,
            strokeWidthStep: 0,
            fill: false,
            fillOpacity: 0.08,
            precision: 2,
        },
        points: [],
        ui: {
            showPoints: true,
            showField: false,
        },
    };
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
