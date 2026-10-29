// Small helpers shared by the page's panels.

import { FT8_DIAL_FREQUENCIES } from '../bands.js';

export const $ = (id) => document.getElementById(id);

/** Settings kept between visits (localStorage, under "qso."). Works without storage too. */
export const store = {
    get(key, fallback = '') { try { return localStorage.getItem(`qso.${key}`) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(`qso.${key}`, value); } catch { /* storage unavailable */ } },
};

/** e.g. "14.074 MHz"; more decimals only when the frequency needs them ("14.0745 MHz"). */
export function formatMHz(hz, digits) {
    if (digits == null) digits = hz % 1000 === 0 ? 3 : hz % 100 === 0 ? 4 : 6;
    return `${(hz / 1e6).toFixed(digits)} MHz`;
}

/** <option>s for the FT8 dial frequencies, e.g. "20m · 14.074 MHz". */
export function bandOptions() {
    return FT8_DIAL_FREQUENCIES.map(({ band, hz }) => new Option(`${band} · ${formatMHz(hz)}`, hz));
}
