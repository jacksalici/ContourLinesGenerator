/**
 * Deterministic value noise + fBm, used to break up the smoothness of the
 * interpolated field so contours read as natural terrain rather than as
 * mathematical blobs.
 */

/** Mulberry32: small, fast, seedable PRNG. */
export function makeRandom(seed) {
    let a = seed >>> 0;
    return function random() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Hash a lattice coordinate to a stable pseudo-random value in [0, 1). */
function hash2(ix, iy, seed) {
    let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Quintic smoothstep — C2 continuous, so no visible lattice creases. */
function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** Value noise at (x, y). Returns [0, 1]. */
export function valueNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);

    const v00 = hash2(x0, y0, seed);
    const v10 = hash2(x0 + 1, y0, seed);
    const v01 = hash2(x0, y0 + 1, seed);
    const v11 = hash2(x0 + 1, y0 + 1, seed);

    return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy);
}

/**
 * Fractal Brownian motion: stacked octaves of value noise.
 * Returns roughly [-1, 1], centred on 0 so it can be added to a field
 * without shifting its mean elevation.
 */
export function fbm(x, y, { octaves = 4, frequency = 3, lacunarity = 2, gain = 0.5, seed = 1 } = {}) {
    let amplitude = 1;
    let freq = frequency;
    let sum = 0;
    let norm = 0;

    for (let o = 0; o < octaves; o++) {
        sum += amplitude * (valueNoise(x * freq, y * freq, seed + o * 1013) * 2 - 1);
        norm += amplitude;
        amplitude *= gain;
        freq *= lacunarity;
    }

    return norm === 0 ? 0 : sum / norm;
}
