/**
 * Marching squares: extract the level set { (x,y) : h(x,y) = level } from a
 * sampled field, as stitched polylines.
 *
 * Per cell we classify the four corners as above/below the level, emit the
 * 0-2 crossing segments implied by that configuration, then join segments into
 * continuous chains. Closed chains become loops (peaks, basins); open chains
 * run off the edge of the frame.
 */

const TL = 8;
const TR = 4;
const BR = 2;
const BL = 1;

/** Segment edge pairs per corner configuration. Edges: 0=top 1=right 2=bottom 3=left. */
const CASES = {
    0: [],
    [BL]: [[3, 2]],
    [BR]: [[2, 1]],
    [BL | BR]: [[3, 1]],
    [TR]: [[0, 1]],
    [TR | BL]: null, // saddle
    [TR | BR]: [[0, 2]],
    [TR | BR | BL]: [[3, 0]],
    [TL]: [[3, 0]],
    [TL | BL]: [[0, 2]],
    [TL | BR]: null, // saddle
    [TL | BR | BL]: [[0, 1]],
    [TL | TR]: [[3, 1]],
    [TL | TR | BL]: [[2, 1]],
    [TL | TR | BR]: [[3, 2]],
    [TL | TR | BR | BL]: [],
};

/** Linear crossing position along an edge between two corner values. */
function crossing(v0, v1, level) {
    const d = v1 - v0;
    if (Math.abs(d) < 1e-12) return 0.5;
    return Math.min(1, Math.max(0, (level - v0) / d));
}

/**
 * Trace one level of a field.
 *
 * @param {import('./field.js').Field} field
 * @param {number} level
 * @returns {Array<{points: Array<[number, number]>, closed: boolean}>} in [0,1] space
 */
export function traceContour(field, level) {
    const { cols, rows } = field;
    const segments = [];

    const cellW = 1 / (cols - 1);
    const cellH = 1 / (rows - 1);

    for (let iy = 0; iy < rows - 1; iy++) {
        for (let ix = 0; ix < cols - 1; ix++) {
            const vTL = field.at(ix, iy);
            const vTR = field.at(ix + 1, iy);
            const vBR = field.at(ix + 1, iy + 1);
            const vBL = field.at(ix, iy + 1);

            let code = 0;
            if (vTL > level) code |= TL;
            if (vTR > level) code |= TR;
            if (vBR > level) code |= BR;
            if (vBL > level) code |= BL;

            let pairs = CASES[code];

            if (pairs === null) {
                // Saddle: the cell centre decides which way the two branches connect.
                const centre = (vTL + vTR + vBR + vBL) / 4;
                if (code === (TR | BL)) {
                    pairs = centre > level ? [[3, 0], [2, 1]] : [[0, 1], [3, 2]];
                } else {
                    pairs = centre > level ? [[0, 1], [3, 2]] : [[3, 0], [2, 1]];
                }
            }

            if (pairs.length === 0) continue;

            const x0 = ix * cellW;
            const y0 = iy * cellH;

            // Crossing point on each of the four cell edges, in [0,1] space.
            const edge = [
                [x0 + crossing(vTL, vTR, level) * cellW, y0],
                [x0 + cellW, y0 + crossing(vTR, vBR, level) * cellH],
                [x0 + crossing(vBL, vBR, level) * cellW, y0 + cellH],
                [x0, y0 + crossing(vTL, vBL, level) * cellH],
            ];

            // Identify each crossing by the grid edge it lies on, not by its
            // coordinates: neighbouring cells then agree exactly, with no
            // floating-point tolerance to tune.
            const key = [
                horizontalKey(ix, iy, cols),
                verticalKey(ix + 1, iy, cols),
                horizontalKey(ix, iy + 1, cols),
                verticalKey(ix, iy, cols),
            ];

            for (const [a, b] of pairs) {
                segments.push({ ak: key[a], ap: edge[a], bk: key[b], bp: edge[b] });
            }
        }
    }

    return stitch(segments);
}

/** Unique id for the horizontal grid edge starting at node (ix, iy). */
function horizontalKey(ix, iy, cols) {
    return (iy * (cols + 1) + ix) * 2;
}

/** Unique id for the vertical grid edge starting at node (ix, iy). */
function verticalKey(ix, iy, cols) {
    return (iy * (cols + 1) + ix) * 2 + 1;
}

/**
 * Join loose segments into polylines.
 *
 * Every crossing sits on a grid edge shared by at most two cells, so each edge
 * id has at most two incident segment ends and the walk is unambiguous.
 * Open chains are traced first from their free ends; whatever remains is a
 * closed loop.
 */
function stitch(segments) {
    /** @type {Map<number, number[]>} edge id -> incident segment indices */
    const incident = new Map();

    const link = (key, index) => {
        const list = incident.get(key);
        if (list) list.push(index);
        else incident.set(key, [index]);
    };

    segments.forEach((s, i) => {
        link(s.ak, i);
        link(s.bk, i);
    });

    const used = new Array(segments.length).fill(false);
    const chains = [];

    /** Follow the chain that enters `startSeg` through edge `startKey`. */
    function walk(startSeg, startKey) {
        const points = [];
        let index = startSeg;
        let key = startKey;

        for (;;) {
            used[index] = true;
            const s = segments[index];
            const forward = s.ak === key;

            if (points.length === 0) points.push(forward ? s.ap : s.bp);

            const endKey = forward ? s.bk : s.ak;
            points.push(forward ? s.bp : s.ap);

            if (endKey === startKey) return { points, closed: true };

            const next = (incident.get(endKey) || []).find((j) => !used[j]);
            if (next === undefined) return { points, closed: false };

            index = next;
            key = endKey;
        }
    }

    // Free ends first: an edge touched by only one segment is a chain terminus
    // (the contour runs off the frame there).
    for (const [key, list] of incident) {
        if (list.length !== 1) continue;
        const index = list[0];
        if (used[index]) continue;
        chains.push(walk(index, key));
    }

    // Anything left is a closed loop.
    for (let i = 0; i < segments.length; i++) {
        if (used[i]) continue;
        chains.push(walk(i, segments[i].ak));
    }

    return chains.filter((c) => c.points.length >= 2);
}

/**
 * Extract every requested level.
 *
 * @returns {Array<{level: number, index: number, lines: Array<{points: Array<[number,number]>, closed: boolean}>}>}
 */
export function traceContours(field, levels) {
    return levels.map((level, index) => ({
        level,
        index,
        lines: traceContour(field, level),
    }));
}
