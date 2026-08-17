/**
 * Interactive control-point layer.
 *
 * Lives in its own <g> above the artwork so it is never part of the export.
 * Interactions: click empty space to add, drag a handle to move, scroll or
 * drag vertically with Shift to change height, alt/right click to delete.
 */

import { createPoint } from './state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Convert a pointer event to normalised [0,1] coordinates inside the SVG. */
function toNormalized(svg, event) {
    const rect = svg.getBoundingClientRect();
    return {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
}

function clamp01(v) {
    return Math.min(1, Math.max(0, v));
}

export class PointsLayer {
    /**
     * @param {SVGSVGElement} svg host svg
     * @param {import('./state.js').Store} store
     */
    constructor(svg, store) {
        this.svg = svg;
        this.store = store;
        this.drag = null;

        this.group = document.createElementNS(SVG_NS, 'g');
        this.group.setAttribute('id', 'control-points');
        this.group.classList.add('points-layer');
        svg.appendChild(this.group);

        this._bindCanvas();
    }

    _bindCanvas() {
        this.svg.addEventListener('pointerdown', (event) => {
            if (!this.store.state.ui.showPoints) return;
            if (event.target.closest('[data-point-id]')) return; // handle takes over
            if (event.button !== 0) return;

            const { x, y } = toNormalized(this.svg, event);
            this.store.update((s) => s.points.push(createPoint(x, y)));
        });

        this.svg.addEventListener('contextmenu', (event) => {
            const handle = event.target.closest('[data-point-id]');
            if (!handle) return;

            event.preventDefault();
            const id = Number(handle.dataset.pointId);
            this.store.update((s) => {
                s.points = s.points.filter((p) => p.id !== id);
            });
        });

        this.svg.addEventListener('wheel', (event) => {
            const handle = event.target.closest('[data-point-id]');
            if (!handle) return;

            event.preventDefault();
            const id = Number(handle.dataset.pointId);
            const delta = -Math.sign(event.deltaY) * 0.05;

            this.store.update((s) => {
                const point = s.points.find((p) => p.id === id);
                if (point) point.z = clamp01(point.z + delta);
            });
        }, { passive: false });
    }

    _bindHandle(handle, point) {
        handle.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.stopPropagation();

            if (event.altKey) {
                this.store.update((s) => {
                    s.points = s.points.filter((p) => p.id !== point.id);
                });
                return;
            }

            handle.setPointerCapture(event.pointerId);
            const start = toNormalized(this.svg, event);
            this.drag = { id: point.id, mode: event.shiftKey ? 'height' : 'move', start, startZ: point.z };
        });

        handle.addEventListener('pointermove', (event) => {
            if (!this.drag || this.drag.id !== point.id) return;

            const pos = toNormalized(this.svg, event);

            this.store.update((s) => {
                const target = s.points.find((p) => p.id === point.id);
                if (!target) return;

                if (this.drag.mode === 'height') {
                    target.z = clamp01(this.drag.startZ - (pos.y - this.drag.start.y) * 2);
                } else {
                    target.x = pos.x;
                    target.y = pos.y;
                }
            });
        });

        const end = (event) => {
            if (this.drag && this.drag.id === point.id) {
                this.drag = null;
                if (handle.hasPointerCapture(event.pointerId)) {
                    handle.releasePointerCapture(event.pointerId);
                }
            }
        };

        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    /** Redraw handles for the current state. */
    render(doc) {
        const { state } = this.store;
        this.group.replaceChildren();
        this.group.style.display = state.ui.showPoints ? '' : 'none';

        if (!state.ui.showPoints) return;

        const scale = Math.min(doc.width, doc.height) / 900;

        for (const point of state.points) {
            const cx = point.x * doc.width;
            const cy = point.y * doc.height;
            const r = (6 + point.z * 12) * scale;

            const handle = document.createElementNS(SVG_NS, 'g');
            handle.dataset.pointId = point.id;
            handle.classList.add('handle');

            const halo = document.createElementNS(SVG_NS, 'circle');
            halo.setAttribute('cx', cx);
            halo.setAttribute('cy', cy);
            halo.setAttribute('r', r);
            halo.classList.add('handle__halo');

            const dot = document.createElementNS(SVG_NS, 'circle');
            dot.setAttribute('cx', cx);
            dot.setAttribute('cy', cy);
            dot.setAttribute('r', 3.5 * scale);
            dot.classList.add('handle__dot');

            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', cx + r + 4 * scale);
            label.setAttribute('y', cy + 4 * scale);
            label.setAttribute('font-size', 11 * scale);
            label.classList.add('handle__label');
            label.textContent = point.z.toFixed(2);

            handle.append(halo, dot, label);
            this.group.appendChild(handle);
            this._bindHandle(handle, point);
        }
    }
}
