/**
 * Canvas viewport: zoom and pan.
 *
 * The view is expressed as the visible rectangle in canvas coordinates and
 * applied through the SVG viewBox, so every coordinate downstream stays in
 * canvas space and only the browser deals with the mapping.
 */

export const MIN_SCALE = 0.2;
export const MAX_SCALE = 40;

export function createView() {
    return { x: 0, y: 0, scale: 1 };
}

/** Visible rectangle, in canvas coordinates. */
export function viewBox(view, canvas) {
    return {
        x: view.x,
        y: view.y,
        width: canvas.width / view.scale,
        height: canvas.height / view.scale,
    };
}

export function resetView(view) {
    view.x = 0;
    view.y = 0;
    view.scale = 1;
}

/**
 * Zoom by `factor`, keeping the canvas point (cx, cy) pinned under the cursor.
 */
export function zoomAt(view, factor, cx, cy) {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
    const applied = next / view.scale;

    view.x = cx - (cx - view.x) / applied;
    view.y = cy - (cy - view.y) / applied;
    view.scale = next;
}

/** Zoom about the centre of the visible area — for the +/- buttons. */
export function zoomCentre(view, factor, canvas) {
    const box = viewBox(view, canvas);
    zoomAt(view, factor, box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Convert a pointer event to canvas coordinates.
 * Uses the SVG's own screen matrix, so viewBox, CSS scaling and letterboxing
 * are all handled for us.
 */
export function toCanvasPoint(svg, event) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
}
