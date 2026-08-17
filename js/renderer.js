/**
 * Turns state into SVG.
 *
 * `buildDocument` produces a plain description of the drawing (no DOM), which
 * is then either mounted into the live preview or serialised for export. Same
 * geometry in both cases — what you see is exactly what you download.
 */

import { buildField, contourLevels } from './field.js';
import { traceContours } from './marching-squares.js';
import { buildPath } from './path.js';
import { contourColor, resolveStyle } from './color.js';
import { viewBox } from './viewport.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Compute the full drawing.
 *
 * @returns {{width:number, height:number, background:string, field:import('./field.js').Field, paths:Array}}
 */
export function buildDocument(state) {
    const { canvas, field: fieldOpts, contours, style, points } = state;
    const { colors, background } = resolveStyle(style);

    const field = buildField(points, fieldOpts);
    const levels = contourLevels(field, contours.count);
    const traced = traceContours(field, levels);

    const inner = {
        x: canvas.padding,
        y: canvas.padding,
        width: canvas.width - canvas.padding * 2,
        height: canvas.height - canvas.padding * 2,
    };

    const project = ([nx, ny]) => [inner.x + nx * inner.width, inner.y + ny * inner.height];

    const pixelTolerance = contours.simplifyTolerance;
    const paths = [];

    for (const contour of traced) {
        const color = contourColor(colors, style.colorMode, contour.index, levels.length);
        const strokeWidth = style.strokeWidth + contour.index * style.strokeWidthStep;

        for (const line of contour.lines) {
            if (line.points.length < contours.minLength) continue;

            const d = buildPath(line, {
                project,
                simplifyTolerance: pixelTolerance,
                smoothing: contours.smoothing,
                precision: style.precision,
            });

            if (!d) continue;

            paths.push({
                d,
                stroke: color,
                strokeWidth: Math.max(0.0, strokeWidth),
                fill: style.fill && line.closed ? color : 'none',
                fillOpacity: style.fill && line.closed ? style.fillOpacity : 0,
                level: contour.level,
                index: contour.index,
            });
        }
    }

    return {
        width: canvas.width,
        height: canvas.height,
        background,
        field,
        paths,
        fieldImage: state.ui.showField ? fieldImageURL(field) : null,
    };
}

/**
 * Render the height field to an off-screen canvas and return it as a data URL,
 * so the preview lives inside the SVG and zooms with the artwork.
 */
const previewCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');

function fieldImageURL(field) {
    if (!previewCanvas) return null;

    const { cols, rows } = field;
    previewCanvas.width = cols;
    previewCanvas.height = rows;

    const ctx = previewCanvas.getContext('2d');
    const image = ctx.createImageData(cols, rows);
    const span = field.max - field.min || 1;

    for (let i = 0; i < cols * rows; i++) {
        const v = Math.round(((field.data[i] - field.min) / span) * 255);
        image.data[i * 4] = v;
        image.data[i * 4 + 1] = v;
        image.data[i * 4 + 2] = v;
        image.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
    return previewCanvas.toDataURL();
}

/** Create an SVG element with attributes in one call. */
function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
        node.setAttribute(k, String(v));
    }
    return node;
}

/**
 * Mount a computed document into an existing <svg> element.
 * Only the artwork layer is written here; the interactive point handles live in
 * a sibling layer so they never leak into the export.
 */
export function mount(svg, doc, view) {
    const box = viewBox(view, doc);
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    svg.setAttribute('width', doc.width);
    svg.setAttribute('height', doc.height);

    let art = svg.querySelector('#artwork');
    if (!art) {
        art = el('g', { id: 'artwork' });
        svg.appendChild(art);
    }
    art.replaceChildren();

    art.appendChild(el('rect', {
        x: 0, y: 0, width: doc.width, height: doc.height, fill: doc.background,
    }));

    if (doc.fieldImage) {
        art.appendChild(el('image', {
            href: doc.fieldImage,
            x: 0, y: 0, width: doc.width, height: doc.height,
            preserveAspectRatio: 'none',
            opacity: 0.85,
        }));
    }

    const lines = el('g', { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });

    for (const p of doc.paths) {
        lines.appendChild(el('path', {
            d: p.d,
            stroke: p.stroke,
            'stroke-width': p.strokeWidth,
            fill: p.fill,
            'fill-opacity': p.fillOpacity,
        }));
    }

    art.appendChild(lines);
    return art;
}

/**
 * Rasterise a document to a PNG blob at `scale`x the canvas size.
 *
 * The SVG is round-tripped through an <img>, so the bitmap comes from exactly
 * the same markup as the SVG export rather than from a second drawing path
 * that could drift out of step with it.
 *
 * @returns {Promise<Blob>}
 */
export function toPNGBlob(doc, scale = 2) {
    const svgBlob = new Blob([serialize(doc)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(doc.width * scale));
            canvas.height = Math.max(1, Math.round(doc.height * scale));

            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Could not encode the PNG'));
            }, 'image/png');
        };

        image.onerror = () => reject(new Error('Could not rasterise the SVG'));
        image.src = url;
    }).finally(() => URL.revokeObjectURL(url));
}

/** Serialise a computed document as a standalone SVG file. */
export function serialize(doc) {
    const body = doc.paths
        .map((p) => {
            const fill = p.fill === 'none'
                ? 'fill="none"'
                : `fill="${p.fill}" fill-opacity="${p.fillOpacity}"`;
            return `    <path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" ${fill}/>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${SVG_NS}" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}">
  <rect width="${doc.width}" height="${doc.height}" fill="${doc.background}"/>
  <g fill="none" stroke-linejoin="round" stroke-linecap="round">
${body}
  </g>
</svg>
`;
}
