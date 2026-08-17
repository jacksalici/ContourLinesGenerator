/**
 * Palette sampling.
 *
 * Contour colour should encode elevation, so the default is a continuous ramp
 * across the palette rather than a per-level cycle (which turns into stripes as
 * soon as there are more levels than colours).
 */

export const COLOR_MODES = {
    ramp: 'Elevation ramp',
    cycle: 'Cycle palette',
    single: 'Single colour',
};

function parseHex(hex) {
    const h = hex.replace('#', '');
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
    if (mode === 'single') return colors[colors.length - 1];
    if (mode === 'cycle') return colors[index % colors.length];
    return sampleRamp(colors, total <= 1 ? 1 : index / (total - 1));
}
