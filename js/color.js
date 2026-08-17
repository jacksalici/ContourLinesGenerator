/**
 * Palettes and palette sampling.
 *
 * Contour colour should encode elevation, so the default is a continuous ramp
 * across the palette rather than a per-level cycle (which turns into stripes as
 * soon as there are more levels than colours).
 *
 * A palette either lists fixed `colors`, or builds them from the current style
 * — that is how the rainbow and single-colour palettes work.
 */

export const COLOR_MODES = {
    ramp: 'Elevation ramp',
    cycle: 'Cycle palette',
    single: 'Single colour',
};

/* ---------- conversions ---------- */

function parseHex(hex) {
    const h = String(hex).replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ];
}

function toHex([r, g, b]) {
    const channel = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
    return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** RGB (0-255) to HSL with h in [0,360) and s, l in [0,1]. */
export function rgbToHsl([r, g, b]) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    const l = (max + min) / 2;

    if (delta === 0) return [0, 0, l];

    const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    let h;
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;

    return [(h * 60 + 360) % 360, s, l];
}

/** HSL to hex. */
export function hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));

    const [r, g, b] = hp < 1 ? [c, x, 0]
        : hp < 2 ? [x, c, 0]
        : hp < 3 ? [0, c, x]
        : hp < 4 ? [0, x, c]
        : hp < 5 ? [x, 0, c]
        : [c, 0, x];

    const m = l - c / 2;
    return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

export function hexToHsl(hex) {
    return rgbToHsl(parseHex(hex));
}

/* ---------- generated palettes ---------- */

/** Stops evenly spaced around the hue wheel, stopping short of a full turn. */
function rainbowColors(count = 12) {
    return Array.from({ length: count }, (_, i) => hslToHex((i / count) * 330, 0.72, 0.5));
}

/**
 * Shades of one colour: fixed hue, lightness sweeping dark to light so the
 * ramp still reads as elevation.
 */
export function shadesOf(hex, count = 7) {
    const [h, s] = hexToHsl(hex);
    const saturation = Math.max(0.18, Math.min(0.95, s));

    return Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0.5 : i / (count - 1);
        return hslToHex(h, saturation, 0.26 + t * 0.52);
    });
}

/** A near-white ground tinted with the base hue, so the page feels deliberate. */
function tintedPaper(hex) {
    const [h, s] = hexToHsl(hex);
    return hslToHex(h, Math.min(0.35, s), 0.965);
}

export const PALETTES = {
    topo: {
        name: 'Topographic',
        background: '#fdf6e3',
        colors: ['#6b4f2a', '#8a6a3b', '#a9854c', '#c6a06a'],
    },
    mono: {
        name: 'Paper white',
        background: '#ffffff',
        colors: ['#2b2b2b', '#555555', '#808080'],
    },
    rainbow: {
        name: 'Rainbow',
        background: '#ffffff',
        build: () => rainbowColors(12),
    },
    custom: {
        name: 'Single colour',
        build: (style) => shadesOf(style.baseColor),
        background: (style) => tintedPaper(style.baseColor),
    },
};

/** Resolve a style into concrete colours and a background. */
export function resolveStyle(style) {
    const palette = PALETTES[style.palette] || PALETTES.topo;

    const colors = palette.build ? palette.build(style) : palette.colors;
    const background = style.background
        || (typeof palette.background === 'function' ? palette.background(style) : palette.background);

    return { colors, background };
}

/* ---------- sampling ---------- */

/** Sample a palette as a continuous gradient at t in [0, 1]. */
export function sampleRamp(colors, t) {
    if (colors.length === 1) return colors[0];

    const clamped = Math.min(1, Math.max(0, t));
    const scaled = clamped * (colors.length - 1);
    const i = Math.min(colors.length - 2, Math.floor(scaled));
    const f = scaled - i;

    const a = parseHex(colors[i]);
    const b = parseHex(colors[i + 1]);

    return toHex([
        a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f,
    ]);
}

/**
 * Colour for one contour band.
 *
 * @param {string[]} colors palette
 * @param {string} mode one of COLOR_MODES
 * @param {number} index contour index
 * @param {number} total number of contours
 */
export function contourColor(colors, mode, index, total) {
    // The middle of a palette, not an end, so "single" stays legible whether
    // the palette runs dark-to-light or the reverse.
    if (mode === 'single') return colors[Math.floor(colors.length / 2)];
    if (mode === 'cycle') return colors[index % colors.length];
    return sampleRamp(colors, total <= 1 ? 1 : index / (total - 1));
}
