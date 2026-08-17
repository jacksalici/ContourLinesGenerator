/**
 * Polyline post-processing: simplify, smooth, and serialise to SVG path data.
 *
 * Marching squares output is faceted at grid resolution. Chaikin corner-cutting
 * rounds it into the flowing lines a hand-drawn contour map has, while
 * Douglas-Peucker first strips redundant collinear vertices so the exported SVG
 * stays small.
 */

/** Perpendicular distance from p to the segment ab. */
function pointSegmentDistance(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);

    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer-Douglas-Peucker simplification. */
export function simplify(points, tolerance) {
    if (tolerance <= 0 || points.length < 3) return points;

    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;

    const stack = [[0, points.length - 1]];

    while (stack.length) {
        const [first, last] = stack.pop();
        let maxDist = 0;
        let index = -1;

        for (let i = first + 1; i < last; i++) {
            const d = pointSegmentDistance(points[i], points[first], points[last]);
            if (d > maxDist) {
                maxDist = d;
                index = i;
            }
        }

        if (index !== -1 && maxDist > tolerance) {
            keep[index] = true;
            stack.push([first, index], [index, last]);
        }
    }

    return points.filter((_, i) => keep[i]);
}

/**
 * Chaikin corner cutting. Each iteration replaces every corner with two points
 * at 1/4 and 3/4 along its edges, converging to a quadratic B-spline.
 */
export function chaikin(points, iterations, closed) {
    let result = points;

    for (let it = 0; it < iterations; it++) {
        if (result.length < 3) break;

        const next = [];
        const n = result.length;
        const limit = closed ? n : n - 1;

        if (!closed) next.push(result[0]);

        for (let i = 0; i < limit; i++) {
            const a = result[i];
            const b = result[(i + 1) % n];

            next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
            next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }

        if (!closed) next.push(result[n - 1]);

        result = next;
    }

    return result;
}

/** Format a number with fixed precision, trimming trailing zeros. */
function fmt(n, precision) {
    return Number(n.toFixed(precision)).toString();
}

/** Serialise a polyline as straight-segment SVG path data. */
export function toPathData(points, { closed = false, precision = 2 } = {}) {
    if (points.length === 0) return '';

    const parts = [`M${fmt(points[0][0], precision)} ${fmt(points[0][1], precision)}`];

    for (let i = 1; i < points.length; i++) {
        parts.push(`L${fmt(points[i][0], precision)} ${fmt(points[i][1], precision)}`);
    }

    if (closed) parts.push('Z');

    return parts.join('');
}

/**
 * Full pipeline for one traced line: simplify in normalised space, map to
 * pixels, smooth, and emit path data.
 */
export function buildPath(line, { project, simplifyTolerance, smoothing, precision }) {
    let points = line.points;

    if (line.closed && points.length > 2) {
        points = points.slice(0, -1); // drop the duplicated closing vertex
    }

    points = simplify(points, simplifyTolerance);
    points = points.map(project);
    points = chaikin(points, smoothing, line.closed);

    return toPathData(points, { closed: line.closed, precision });
}
