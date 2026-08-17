/**
 * Declarative control panel.
 *
 * Controls are described as data and bound to the store either by a state path
 * or by an explicit get/set pair, so adding a parameter is one schema entry —
 * no bespoke DOM or wiring per input.
 */

import { INTERPOLATION_METHODS, MASK_SHAPES } from './field.js';
import { COLOR_MODES, PALETTES } from './color.js';
import { selectedPoint } from './state.js';

function getPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc[key], obj);
}

function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((acc, key) => acc[key], obj)[last] = value;
}

/** Read/write pair for one control, from either `path` or explicit accessors. */
function accessor(item) {
    if (item.path) {
        return {
            get: (state) => getPath(state, item.path),
            set: (state, value) => setPath(state, item.path, value),
        };
    }
    return { get: item.get, set: item.set };
}

/** Slider bound to a field of the currently selected point. */
function pointControl(label, key, { min = 0, max = 1, step = 0.005 } = {}) {
    return {
        type: 'range',
        label,
        min,
        max,
        step,
        get: (state) => selectedPoint(state)?.[key] ?? 0,
        set: (state, value) => {
            const point = selectedPoint(state);
            if (point) point[key] = value;
        },
    };
}

export const SCHEMA = [
    {
        title: 'Selected point',
        visible: (state) => selectedPoint(state) !== null,
        items: [
            pointControl('X', 'x'),
            pointControl('Y', 'y'),
            pointControl('Height', 'z'),
            {
                type: 'button',
                label: 'Delete point',
                onClick: (state) => {
                    state.points = state.points.filter((p) => p.id !== state.ui.selectedId);
                    state.ui.selectedId = null;
                },
            },
        ],
    },
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
                type: 'color', path: 'style.baseColor', label: 'Base colour',
                visible: (s) => s.style.palette === 'custom',
            },
            {
                type: 'select', path: 'style.colorMode', label: 'Colour mode',
                options: Object.entries(COLOR_MODES).map(([value, label]) => ({ value, label })),
            },
            { type: 'range', path: 'style.strokeWidth', label: 'Stroke width', min: 0.0, max: 8, step: 0.1 },
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

const INPUT_TYPE = { range: 'range', number: 'number', checkbox: 'checkbox', color: 'color' };

/** Build one labelled input bound to the store. */
function buildControl(item, store) {
    if (item.type === 'button') {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.label;
        button.addEventListener('click', () => store.update(item.onClick));
        return { row: button, read: () => {}, item };
    }

    const row = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = item.label;

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
        input.type = INPUT_TYPE[item.type] || 'number';
        if (item.min !== undefined) input.min = item.min;
        if (item.max !== undefined) input.max = item.max;
        if (item.step !== undefined) input.step = item.step;
    }

    const { get, set } = accessor(item);

    // Only ranges get a readout; the others already show their value.
    const output = item.type === 'range' ? document.createElement('output') : null;

    const read = () => {
        const current = get(store.state);
        if (item.type === 'checkbox') input.checked = Boolean(current);
        else input.value = current;
        if (output) output.textContent = Number(current).toFixed(item.step < 0.01 ? 4 : 2).replace(/\.?0+$/, '');
    };

    input.addEventListener('input', () => {
        let next;
        if (item.type === 'checkbox') next = input.checked;
        else if (item.type === 'select' || item.type === 'color') next = input.value;
        else {
            next = parseFloat(input.value);
            if (Number.isNaN(next)) return;
        }
        store.update((state) => set(state, next));
    });

    read();
    row.append(caption, input);
    if (output) row.append(output);

    return { row, read, item };
}

/** Render the panel and keep it in sync with the store. */
export function buildPanel(container, store) {
    const sections = [];

    for (const group of SCHEMA) {
        const section = document.createElement('section');
        const heading = document.createElement('h2');
        heading.textContent = group.title;
        section.appendChild(heading);

        const controls = group.items.map((item) => {
            const control = buildControl(item, store);
            section.appendChild(control.row);
            return control;
        });

        container.appendChild(section);
        sections.push({ group, section, controls });
    }

    const refresh = () => {
        for (const { group, section, controls } of sections) {
            const groupVisible = group.visible ? group.visible(store.state) : true;
            section.hidden = !groupVisible;
            if (!groupVisible) continue;

            for (const { row, read, item } of controls) {
                const visible = item.visible ? item.visible(store.state) : true;
                row.hidden = !visible;
                if (visible) read();
            }
        }
    };

    store.subscribe(refresh);
    refresh();

    return refresh;
}
