// Amateur bands: the usual FT8 dial frequencies, and which band a frequency is in. No DOM.

/** Common FT8 dial frequencies (upper sideband). */
export const FT8_DIAL_FREQUENCIES = [
    { band: '160 m', hz: 1840000 },
    { band: '80 m', hz: 3573000 },
    { band: '60 m', hz: 5357000 },
    { band: '40 m', hz: 7074000 },
    { band: '30 m', hz: 10136000 },
    { band: '20 m', hz: 14074000 },
    { band: '17 m', hz: 18100000 },
    { band: '15 m', hz: 21074000 },
    { band: '12 m', hz: 24915000 },
    { band: '10 m', hz: 28074000 },
    { band: '6 m', hz: 50313000 },
    { band: '2 m', hz: 144174000 },
];

// Band edges in Hz, as in the ADIF specification's Band enumeration (HF to 70 cm).
const BAND_EDGES = [
    ['160m', 1.8e6, 2.0e6],
    ['80m', 3.5e6, 4.0e6],
    ['60m', 5.06e6, 5.45e6],
    ['40m', 7.0e6, 7.3e6],
    ['30m', 10.1e6, 10.15e6],
    ['20m', 14.0e6, 14.35e6],
    ['17m', 18.068e6, 18.168e6],
    ['15m', 21.0e6, 21.45e6],
    ['12m', 24.89e6, 24.99e6],
    ['10m', 28.0e6, 29.7e6],
    ['6m', 50e6, 54e6],
    ['4m', 70e6, 71e6],
    ['2m', 144e6, 148e6],
    ['1.25m', 222e6, 225e6],
    ['70cm', 420e6, 450e6],
];

/** ADIF band name for a frequency, e.g. '20m' for 14,075,500 Hz; null outside the bands. */
export function adifBand(hz) {
    if (hz == null) return null;
    return BAND_EDGES.find(([, lo, hi]) => hz >= lo && hz <= hi)?.[0] ?? null;
}

/** Band name as the page shows it, e.g. '20 m'; null outside the bands. */
export function bandName(hz) {
    return adifBand(hz)?.replace(/^([\d.]+)(c?m)$/, '$1 $2') ?? null;
}
