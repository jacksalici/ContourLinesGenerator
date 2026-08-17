/**
 * App wiring: store -> render loop -> DOM.
 */

import { Store, createDefaultState, randomPoints } from './state.js';
import { makeRandom } from './noise.js';
import { buildPanel } from './controls.js';
import { buildDocument, mount, serialize, renderFieldPreview } from './renderer.js';
import { PointsLayer } from './points-layer.js';

const svg = document.getElementById('stage');
const fieldCanvas = document.getElementById('field-preview');
const panel = document.getElementById('panel');
const stats = document.getElementById('stats');

const store = new Store(createDefaultState());
const pointsLayer = new PointsLayer(svg, store);

store.state.points = randomPoints(9, makeRandom(store.state.field.seed));

/** Render is throttled to one pass per frame; state can change as fast as it likes. */
let frame = null;

function scheduleRender() {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
        frame = null;
        render();
    });
}

let lastDoc = null;

function render() {
    const started = performance.now();
    const doc = buildDocument(store.state);
    lastDoc = doc;

    mount(svg, doc);
    pointsLayer.render(doc);
    svg.appendChild(pointsLayer.group); // keep handles above the artwork

    if (store.state.ui.showField) {
        renderFieldPreview(fieldCanvas, doc.field);
        fieldCanvas.hidden = false;
    } else {
        fieldCanvas.hidden = true;
    }

    document.body.style.setProperty('--stage-bg', doc.background);

    const elapsed = performance.now() - started;
    stats.textContent = `${store.state.points.length} points · ${doc.paths.length} paths · ${elapsed.toFixed(0)} ms`;
}

store.subscribe(scheduleRender);

buildPanel(panel, store);

/** Trigger a browser download for generated text content. */
function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

const actions = {
    'random-points': () => {
        store.update((s) => {
            s.field.seed = Math.floor(Math.random() * 10000);
            s.points = randomPoints(
                Math.max(3, s.points.length || 9),
                makeRandom(s.field.seed),
            );
        });
    },
    'add-point': () => {
        const random = makeRandom(Date.now() & 0xffff);
        store.update((s) => s.points.push(...randomPoints(1, random)));
    },
    'clear-points': () => {
        store.update((s) => { s.points = []; });
    },
    'reset': () => {
        store.update((s) => {
            Object.assign(s, createDefaultState());
            s.points = randomPoints(9, makeRandom(s.field.seed));
        });
    },
    'export-svg': () => {
        download('contours.svg', serialize(lastDoc), 'image/svg+xml');
    },
    'export-json': () => {
        const { points, canvas, field, contours, style } = store.state;
        download('contours.json', JSON.stringify({ points, canvas, field, contours, style }, null, 2), 'application/json');
    },
    'import-json': () => {
        document.getElementById('file-input').click();
    },
};

for (const [action, handler] of Object.entries(actions)) {
    const button = document.querySelector(`[data-action="${action}"]`);
    if (button) button.addEventListener('click', handler);
}

document.getElementById('file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const parsed = JSON.parse(await file.text());
        store.update((s) => {
            Object.assign(s, createDefaultState(), parsed);
        });
    } catch (error) {
        stats.textContent = `Could not read that file: ${error.message}`;
    }

    event.target.value = '';
});

render();
