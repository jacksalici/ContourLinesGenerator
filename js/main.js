/**
 * App wiring: store -> render loop -> DOM.
 */

import { Store, createDefaultState, createPoint, randomPoints } from './state.js';
import { makeRandom } from './noise.js';
import { buildPanel } from './controls.js';
import { buildDocument, mount, serialize } from './renderer.js';
import { PointsLayer } from './points-layer.js';
import { resetView, zoomCentre } from './viewport.js';
import { applyQuery, stateURL } from './url.js';

const svg = document.getElementById('stage');
const panel = document.getElementById('panel');
const stats = document.getElementById('stats');

const store = new Store(createDefaultState());
const pointsLayer = new PointsLayer(svg, store);

// The URL is the save format; fall back to a random scatter for a first visit.
if (!applyQuery(store.state, location.search, createPoint)) {
    store.state.points = randomPoints(9, makeRandom(store.state.field.seed));
}

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

    mount(svg, doc, store.state.view);
    pointsLayer.render(doc);
    svg.appendChild(pointsLayer.group); // keep handles above the artwork

    const elapsed = performance.now() - started;
    const zoom = store.state.view.scale;
    stats.textContent = `${store.state.points.length} points · ${doc.paths.length} paths `
        + `· ${zoom.toFixed(2)}× · ${elapsed.toFixed(0)} ms`;
}

store.subscribe(scheduleRender);

/**
 * Mirror state into the address bar, well after the last edit.
 *
 * Encoding is cheap, but history.replaceState is not something to do on every
 * frame of a slider drag, so it is debounced rather than tied to the render.
 */
let urlTimer = null;

function scheduleURLSync() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
        history.replaceState(null, '', stateURL(store.state));
    }, 400);
}

store.subscribe(scheduleURLSync);

buildPanel(panel, store);

/** Briefly replace the stats line with a message. */
function flash(message) {
    stats.textContent = message;
    setTimeout(scheduleRender, 1500);
}

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
            s.ui.selectedId = null;
        });
    },
    'add-point': () => {
        const random = makeRandom(Date.now() & 0xffff);
        store.update((s) => {
            const [point] = randomPoints(1, random);
            s.points.push(point);
            s.ui.selectedId = point.id;
        });
    },
    'clear-points': () => {
        store.update((s) => {
            s.points = [];
            s.ui.selectedId = null;
        });
    },
    'reset': () => {
        store.update((s) => {
            Object.assign(s, createDefaultState());
            s.points = randomPoints(9, makeRandom(s.field.seed));
        });
    },
    'zoom-in': () => store.update((s) => zoomCentre(s.view, 1.25, s.canvas)),
    'zoom-out': () => store.update((s) => zoomCentre(s.view, 1 / 1.25, s.canvas)),
    'zoom-reset': () => store.update((s) => resetView(s.view)),
    'export-svg': () => {
        download('contours.svg', serialize(lastDoc), 'image/svg+xml');
    },
    'copy-url': async () => {
        const url = stateURL(store.state);
        history.replaceState(null, '', url);

        try {
            await navigator.clipboard.writeText(url);
            flash('Link copied to clipboard');
        } catch {
            // Clipboard access can be refused; the address bar still has it.
            flash('Link is in the address bar — copy it from there');
        }
    },
};

for (const [action, handler] of Object.entries(actions)) {
    const button = document.querySelector(`[data-action="${action}"]`);
    if (button) button.addEventListener('click', handler);
}

render();
