/**
 * Declarative control panel.
 *
 * Controls are described as data and bound to state paths, so adding a new
 * parameter is one entry in the schema — no bespoke DOM or wiring per input.
 */

import { INTERPOLATION_METHODS, MASK_SHAPES } from './field.js';
import { COLOR_MODES } from './color.js';
import { PALETTES } from './state.js';

function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc[key], obj);
}

function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((acc, key) => acc[key], obj);
    target[last] = value;
}

/** @type {Array<{title: string, items: Array<object>}>} */
export const SCHEMA = [
    {
        title: 'Canvas',
        items: [
            { type: 'number', path: 'canvas.width', label: 'Width (px)', min: 100, max: 5000, step: 10 },
            { type: 'number', path: 'canvas.height', label: 'Height (px)', min: 100, max: 5000, step: 10 },
            { type: 'range', path: 'canvas.padding', label: 'Padding', min: 0, max: 300, step: 1 },
        ],
    },
    {
        title: 'Terrain',
        items: [
            {
                type: 'select', path: 'field.method', label: 'Interpolation',
                options: Object.entries(INTERPOLATION_METHODS).map(([value, label]) => ({ value, label })),
            },
            {
                type: 'range', path: 'field.radius', label: 'Peak radius', min: 0.02, max: 1, step: 0.01,
                visible: (s) => s.field.method !== 'idw',
            },
            {
                type: 'range', path: 'field.power', label: 'Falloff power', min: 0.5, max: 8, step: 0.1,
                visible: (s) => s.field.method === 'idw',
            },
            {
                type: 'select', path: 'field.maskShape', label: 'Border mask',
                options: Object.entries(MASK_SHAPES).map(([value, label]) => ({ value, label })),
            },
            {
                type: 'range', path: 'field.edgeFalloff', label: 'Mask falloff', min: 0.01, max: 1, step: 0.01,
                visible: (s) => s.field.maskShape !== 'none',
            },
            { type: 'range', path: 'field.resolution', label: 'Grid resolution', min: 30, max: 500, step: 10 },
        ],
    },
    {
        title: 'Noise',
        items: [
            { type: 'range', path: 'field.noiseAmount', label: 'Amount', min: 0, max: 1.5, step: 0.01 },
            { type: 'range', path: 'field.noiseScale', label: 'Scale', min: 0.5, max: 12, step: 0.1 },
            { type: 'range', path: 'field.noiseOctaves', label: 'Octaves', min: 1, max: 8, step: 1 },
            { type: 'number', path: 'field.seed', label: 'Seed', min: 0, max: 99999, step: 1 },
        ],
    },
    {
        title: 'Contours',
        items: [
            { type: 'range', path: 'contours.count', label: 'Number of lines', min: 1, max: 120, step: 1 },
            { type: 'range', path: 'contours.smoothing', label: 'Smoothing', min: 0, max: 6, step: 1 },
            { type: 'range', path: 'contours.simplifyTolerance', label: 'Simplify', min: 0, max: 0.01, step: 0.0005 },
            { type: 'range', path: 'contours.minLength', label: 'Min line length', min: 2, max: 60, step: 1 },
        ],
    },
    {
        title: 'Style',
        items: [
            {
                type: 'select', path: 'style.palette', label: 'Palette',
                options: Object.entries(PALETTES).map(([value, p]) => ({ value, label: p.name })),
            },
            {
                type: 'select', path: 'style.colorMode', label: 'Colour mode',
                options: Object.entries(COLOR_MODES).map(([value, label]) => ({ value, label })),
            },
            { type: 'range', path: 'style.strokeWidth', label: 'Stroke width', min: 0.1, max: 8, step: 0.1 },
            { type: 'range', path: 'style.strokeWidthStep', label: 'Width ramp', min: -0.2, max: 0.2, step: 0.005 },
            { type: 'checkbox', path: 'style.fill', label: 'Fill closed shapes' },
            {
                type: 'range', path: 'style.fillOpacity', label: 'Fill opacity', min: 0, max: 1, step: 0.01,
                visible: (s) => s.style.fill,
            },
        ],
    },
    {
        title: 'View',
        items: [
            { type: 'checkbox', path: 'ui.showPoints', label: 'Show control points' },
            { type: 'checkbox', path: 'ui.showField', label: 'Show height field' },
        ],
    },
];

/** Build one labelled input bound to a state path. */
function buildControl(item, store) {
    const row = document.createElement('label');
    row.className = `control control--${item.type}`;

    const caption = document.createElement('span');
    caption.className = 'control__label';
    caption.textContent = item.label;

    const value = document.createElement('span');
    value.className = 'control__value';

    let input;

    if (item.type === 'select') {
        input = document.createElement('select');
        for (const opt of item.options) {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            input.appendChild(option);
        }
    } else {
        input = document.createElement('input');
        input.type = item.type === 'checkbox' ? 'checkbox' : (item.type === 'color' ? 'color' : (item.type === 'range' ? 'range' : 'number'));
        if (item.min !== undefined) input.min = item.min;
        if (item.max !== undefined) input.max = item.max;
        if (item.step !== undefined) input.step = item.step;
    }

    input.className = 'control__input';

    const read = () => {
        const current = getPath(store.state, item.path);
        if (item.type === 'checkbox') {
            input.checked = Boolean(current);
        } else {
            input.value = current;
        }
        value.textContent = item.type === 'range' ? String(current) : '';
    };

    const write = () => {
        let next;
        if (item.type === 'checkbox') {
            next = input.checked;
        } else if (item.type === 'select' || item.type === 'color') {
            next = input.value;
        } else {
            next = parseFloat(input.value);
            if (Number.isNaN(next)) return;
        }

        store.update((s) => setPath(s, item.path, next));
    };

    input.addEventListener('input', write);
    read();

    row.append(caption, input, value);

    return { row, read, item };
}

/**
 * Render the whole panel and keep it in sync with the store.
 *
 * @returns {() => void} refresh function
 */
export function buildPanel(container, store) {
    const bound = [];

    for (const group of SCHEMA) {
        const section = document.createElement('section');
        section.className = 'panel__group';

        const heading = document.createElement('h2');
        heading.textContent = group.title;
        section.appendChild(heading);

        for (const item of group.items) {
            const control = buildControl(item, store);
            section.appendChild(control.row);
            bound.push(control);
        }

        container.appendChild(section);
    }

    const refresh = () => {
        for (const { row, read, item } of bound) {
            const visible = item.visible ? item.visible(store.state) : true;
            row.hidden = !visible;
            if (visible) read();
        }
    };

    store.subscribe(refresh);
    refresh();

    return refresh;
}
