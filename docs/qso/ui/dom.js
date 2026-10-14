// Small helpers shared by the page's panels.

import { FT8_DIAL_FREQUENCIES } from '../sources/rtlsdr.js';

export const $ = (id) => document.getElementById(id);

/** Settings kept between visits (localStorage, under "qso."). Works without storage too. */
export const store = {
    get(key, fallback = '') { try { return localStorage.getItem(`qso.${key}`) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(`qso.${key}`, value); } catch { /* storage unavailable */ } },
};

export const formatMHz = (hz, digits = 3) => `${(hz / 1e6).toFixed(digits)} MHz`;

/** <option>s for the FT8 dial frequencies, e.g. "20m · 14.074 MHz". */
export function bandOptions() {
    return FT8_DIAL_FREQUENCIES.map(({ band, hz }) => new Option(`${band} · ${formatMHz(hz)}`, hz));
}

export function bandName(hz) {
    return FT8_DIAL_FREQUENCIES.find(b => b.hz === hz)?.band ?? null;
}
