/**
 * Interactive control-point layer and canvas navigation.
 *
 * Lives in its own <g> above the artwork so it is never part of the export.
 *
 * Canvas: wheel zooms about the cursor, dragging empty space pans, clicking
 * empty space adds a point.
 * Handles: click selects, drag moves, Shift+drag or wheel changes height,
 * Alt+click or right click deletes.
 * Touch: one finger pans, two fingers pinch to zoom, a tap selects the nearest
 * point (or clears the selection).
 */

import { createPoint } from './state.js';
import { toCanvasPoint, zoomAt } from './viewport.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DRAG_THRESHOLD = 4; // px of movement before a click becomes a pan
const TAP_RADIUS = 26; // screen px a tap may miss a point by and still select it
const ACCENT = '#b06a00';

function clamp01(v) {
    return Math.min(1, Math.max(0, v));
}

/**
 * A fingertip covers far more than a handle, so on touch a drag would be a
 * mis-grab and a tap on empty canvas an accidental point: touch may select a
 * point and pan the canvas, nothing more. Moving, adding and deleting are done
 * with a mouse, or from the sliders and the delete button in the panel.
 */
function isTouch(event) {
    return event.pointerType === 'touch';
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
        this.pan = null;
        this.pointers = new Map(); // live pointers, for pinch detection
        this.pinch = null;
        this.pinched = false; // a pinch happened, so the release is not a tap

        this.group = document.createElementNS(SVG_NS, 'g');
        this.group.setAttribute('id', 'control-points');
        svg.appendChild(this.group);

        this._bindCanvas();
    }

    /** Pointer position in normalised [0,1] canvas coordinates. */
    _normalized(event) {
        const { canvas } = this.store.state;
        const p = toCanvasPoint(this.svg, event);
        return { x: clamp01(p.x / canvas.width), y: clamp01(p.y / canvas.height) };
    }

    /** Canvas units per screen pixel at the current zoom. */
    _unitsPerPixel() {
        const { canvas, view } = this.store.state;
        const rect = this.svg.getBoundingClientRect();
        if (rect.width === 0) return 1;
        return canvas.width / view.scale / rect.width;
    }

    /**
     * The control point nearest to a normalised position, within `radius`
     * canvas units, or null.
     *
     * Touch selection goes through this instead of hit-testing the handle,
     * which is only a few screen pixels wide once a 900px canvas is scaled to
     * fit a phone — far too small to land a finger on.
     */
    _pointNear(pos, radius) {
        const { canvas, points } = this.store.state;
        let best = null;
        let bestDistance = radius;

        for (const point of points) {
            const distance = Math.hypot(
                (point.x - pos.x) * canvas.width,
                (point.y - pos.y) * canvas.height,
            );

            if (distance <= bestDistance) {
                bestDistance = distance;
                best = point;
            }
        }

        return best;
    }

    /** Two fingers down: remember the span and midpoint the gesture starts from. */
    _beginPinch() {
        const [a, b] = [...this.pointers.values()];

        this.drag = null;
        this.pan = null;
        this.pinched = true;
        this.pinch = {
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
    }

    /** Apply a pinch: the span scales the zoom, the midpoint drags the canvas. */
    _pinchTo() {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

        if (distance === 0 || this.pinch.distance === 0) return;

        const factor = distance / this.pinch.distance;
        const anchor = toCanvasPoint(this.svg, { clientX: mid.x, clientY: mid.y });
        const units = this._unitsPerPixel();
        const dx = mid.x - this.pinch.mid.x;
        const dy = mid.y - this.pinch.mid.y;

        this.pinch = { distance, mid };

        this.store.update((s) => {
            zoomAt(s.view, factor, anchor.x, anchor.y);
            s.view.x -= dx * units;
            s.view.y -= dy * units;
        });
    }

    _bindCanvas() {
        this.svg.addEventListener('wheel', (event) => {
            event.preventDefault();

            const handle = event.target.closest('[data-point-id]');

            if (handle) {
                // Over a handle the wheel adjusts height instead of zooming.
                const id = Number(handle.dataset.pointId);
                const delta = -Math.sign(event.deltaY) * 0.05;

                this.store.update((s) => {
                    const point = s.points.find((p) => p.id === id);
                    if (point) point.z = clamp01(point.z + delta);
                });
                return;
            }

            const { x, y } = toCanvasPoint(this.svg, event);
            const factor = Math.pow(1.0015, -event.deltaY);
            this.store.update((s) => zoomAt(s.view, factor, x, y));
        }, { passive: false });

        // Pointer handling is delegated to the <svg>, which persists, rather
        // than to the handles, which are rebuilt on every render.
        this.svg.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;

            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

            if (this.pointers.size === 2) {
                this._beginPinch();
                return;
            }

            if (this.pointers.size > 2) return;

            const handle = event.target.closest('[data-point-id]');
            this.svg.setPointerCapture(event.pointerId);

            // Touch never grabs a handle: it pans, and a release that did not
            // move is treated as a tap.
            if (!handle || isTouch(event)) {
                this.pan = { x: event.clientX, y: event.clientY, moved: false };
                return;
            }

            const id = Number(handle.dataset.pointId);

            if (event.altKey) {
                this._delete(id);
                return;
            }

            const point = this.store.state.points.find((p) => p.id === id);
            if (!point) return;

            this.drag = {
                id,
                mode: event.shiftKey ? 'height' : 'move',
                start: this._normalized(event),
                startZ: point.z,
            };

            this.store.update((s) => { s.ui.selectedId = id; });
        });

        this.svg.addEventListener('pointermove', (event) => {
            if (this.pointers.has(event.pointerId)) {
                this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            }

            if (this.pinch) {
                if (this.pointers.size >= 2) this._pinchTo();
                return;
            }

            if (this.drag) {
                this._dragTo(event);
                return;
            }

            if (!this.pan) return;

            const dx = event.clientX - this.pan.x;
            const dy = event.clientY - this.pan.y;

            if (!this.pan.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            this.pan.moved = true;

            const units = this._unitsPerPixel();
            this.pan.x = event.clientX;
            this.pan.y = event.clientY;

            this.store.update((s) => {
                s.view.x -= dx * units;
                s.view.y -= dy * units;
            });
        });

        this.svg.addEventListener('pointerup', (event) => {
            this.pointers.delete(event.pointerId);

            if (this.pinch) {
                // Lifting one finger ends the pinch; the other is left alone
                // rather than becoming a pan halfway through the gesture.
                if (this.pointers.size < 2) this.pinch = null;
                return;
            }

            const pinched = this.pinched;
            if (this.pointers.size === 0) this.pinched = false;

            if (this.drag) {
                this.drag = null;
                return;
            }

            if (!this.pan) return;

            const { moved } = this.pan;
            this.pan = null;

            if (moved || pinched) return; // that was a pan or a pinch, not a click
            if (!this.store.state.ui.showPoints) return;

            if (isTouch(event)) {
                // A tap selects the nearest point within a fingertip's reach,
                // and otherwise clears the selection. It never adds one.
                const near = this._pointNear(
                    this._normalized(event),
                    TAP_RADIUS * this._unitsPerPixel(),
                );

                this.store.update((s) => { s.ui.selectedId = near ? near.id : null; });
                return;
            }

            const { x, y } = this._normalized(event);
            this.store.update((s) => {
                const point = createPoint(x, y);
                s.points.push(point);
                s.ui.selectedId = point.id;
            });
        });

        this.svg.addEventListener('pointercancel', (event) => {
            this.pointers.delete(event.pointerId);
            if (this.pointers.size < 2) this.pinch = null;
            if (this.pointers.size === 0) this.pinched = false;
            this.pan = null;
            this.drag = null;
        });

        this.svg.addEventListener('contextmenu', (event) => {
            const handle = event.target.closest('[data-point-id]');
            if (!handle) return;

            event.preventDefault();
            this._delete(Number(handle.dataset.pointId));
        });
    }

    _delete(id) {
        this.store.update((s) => {
            s.points = s.points.filter((p) => p.id !== id);
            if (s.ui.selectedId === id) s.ui.selectedId = null;
        });
    }

    /** Apply an in-progress handle drag. */
    _dragTo(event) {
        const pos = this._normalized(event);

        this.store.update((s) => {
            const target = s.points.find((p) => p.id === this.drag.id);
            if (!target) return;

            if (this.drag.mode === 'height') {
                target.z = clamp01(this.drag.startZ - (pos.y - this.drag.start.y) * 2);
            } else {
                target.x = pos.x;
                target.y = pos.y;
            }
        });
    }

    /** Redraw handles for the current state. */
    render(doc) {
        const { state } = this.store;
        this.group.replaceChildren();
        this.group.style.display = state.ui.showPoints ? '' : 'none';

        if (!state.ui.showPoints) return;

        // Handle geometry is divided by the zoom so it stays a constant size
        // on screen however far in you are.
        const unit = Math.min(doc.width, doc.height) / 900 / state.view.scale;

        for (const point of state.points) {
            const cx = point.x * doc.width;
            const cy = point.y * doc.height;
            const r = (6 + point.z * 12) * unit;
            const selected = point.id === state.ui.selectedId;

            const handle = document.createElementNS(SVG_NS, 'g');
            handle.dataset.pointId = point.id;
            handle.style.cursor = 'grab';

            const halo = document.createElementNS(SVG_NS, 'circle');
            halo.setAttribute('cx', cx);
            halo.setAttribute('cy', cy);
            halo.setAttribute('r', r);
            halo.setAttribute('fill', selected ? 'rgba(176,106,0,0.25)' : 'rgba(176,106,0,0.1)');
            halo.setAttribute('stroke', ACCENT);
            halo.setAttribute('stroke-width', (selected ? 2.5 : 1) * unit);

            const dot = document.createElementNS(SVG_NS, 'circle');
            dot.setAttribute('cx', cx);
            dot.setAttribute('cy', cy);
            dot.setAttribute('r', 3.5 * unit);
            dot.setAttribute('fill', selected ? '#000' : ACCENT);

            const label = document.createElementNS(SVG_NS, 'text');
            label.setAttribute('x', cx + r + 4 * unit);
            label.setAttribute('y', cy + 4 * unit);
            label.setAttribute('font-size', 11 * unit);
            label.setAttribute('font-family', 'sans-serif');
            label.setAttribute('fill', ACCENT);
            label.style.pointerEvents = 'none';
            label.textContent = point.z.toFixed(2);

            handle.append(halo, dot, label);
            this.group.appendChild(handle);
        }
    }
}
