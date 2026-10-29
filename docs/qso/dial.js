// The station's dial frequency: one value for the whole page, used by the RTL-SDR, the radio
// (over CAT) and the log. No DOM.
//
// Rules (the RTL-SDR input and the radio panel follow them; see their 'change' listeners):
//   - The user's choice tunes the radio over CAT, if connected, and a running RTL-SDR.
//     It is remembered between visits.
//   - While CAT is connected the radio is in charge: the frequency read from it becomes the
//     dial, and a running RTL-SDR retunes to follow. A frequency read from the radio is never
//     sent back to it.
//   - Null means not known. With a sound card and no CAT it starts unset, so the log never
//     records a band the user didn't choose. The RTL-SDR needs a frequency, so choosing it
//     sets one (the last RTL-SDR frequency, or 14.074 MHz).
//
// Events (CustomEvent): 'change', detail { hz, from: 'user' | 'radio' }.

const KEY = 'qso.dial';

export class Dial extends EventTarget {
    /** @param {{storage?: Storage|null}} options */
    constructor({ storage } = {}) {
        super();
        try { this.storage = storage === undefined ? globalThis.localStorage ?? null : storage; } catch { this.storage = null; }
        let saved = null;
        try { saved = this.storage?.getItem(KEY) ?? this.storage?.getItem('qso.soundcardDial'); } catch { /* storage unavailable */ }
        this.hz = Number(saved) || null;
    }

    /** The user chose a frequency. */
    set(hz) {
        hz = Number(hz) || null;
        try { this.storage?.setItem(KEY, hz ?? ''); } catch { /* storage unavailable */ }
        this.update(hz, 'user');
    }

    /** The radio reported its frequency (CAT). */
    fromRadio(hz) {
        if (hz && hz !== this.hz) this.update(hz, 'radio');
    }

    update(hz, from) {
        const changed = hz !== this.hz;
        this.hz = hz;
        if (changed || from === 'user') this.dispatchEvent(new CustomEvent('change', { detail: { hz, from } }));
    }
}
