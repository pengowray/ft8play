// The Dial frequency list in the Audio input section, and the note after it saying what
// choosing a frequency does: tunes the RTL-SDR, tunes the radio (CAT), both, or only goes in
// the log. Shown for the sound card and RTL-SDR inputs, and whenever CAT is connected.

import { FT8_DIAL_FREQUENCIES, bandName } from '../bands.js';
import { $, bandOptions, formatMHz } from './dom.js';

const TEXT = {
    unset: 'Not set',
    // A frequency read from the radio that isn't one of the list's, in the list's format.
    other: (hz) => (bandName(hz) ? `${bandName(hz)} · ${formatMHz(hz)}` : formatMHz(hz)),
    note: {
        logOnly: 'For the log only. Choose the frequency the radio is on.',
        radio: 'Tunes the radio.',
        rtlsdr: 'Tunes the RTL-SDR.',
        both: 'Tunes the radio. The RTL-SDR follows the radio.',
    },
};

export class DialControl {
    /**
     * @param {{dial: import('../dial.js').Dial, cat: () => boolean}} options
     *   cat: true while radio control reads and sets the radio's frequency
     */
    constructor({ dial, cat }) {
        this.dial = dial;
        this.cat = cat;
        this.field = $('dial-field');
        this.select = $('dial');
        this.note = $('dial-note');
        this.kind = null;
        this.select.addEventListener('change', () => dial.set(this.select.value));
        dial.addEventListener('change', () => this.render(this.kind));
    }

    /** @param {string} kind the chosen input: 'soundcard', 'rtlsdr', 'test' or 'file' */
    render(kind) {
        this.kind = kind;
        const cat = this.cat();
        const rtl = kind === 'rtlsdr';
        this.field.hidden = !(rtl || kind === 'soundcard' || cat);
        if (this.field.hidden) return;

        // Options: "Not set" only while unset; the radio's frequency if it isn't in the list.
        const hz = this.dial.hz;
        const options = bandOptions();
        if (!hz) options.unshift(new Option(TEXT.unset, ''));
        else if (!FT8_DIAL_FREQUENCIES.some(b => b.hz === hz)) options.unshift(new Option(TEXT.other(hz), hz));
        if (document.activeElement !== this.select) {
            this.select.replaceChildren(...options);
            this.select.value = hz ?? '';
        }
        this.note.textContent = rtl && cat ? TEXT.note.both : rtl ? TEXT.note.rtlsdr : cat ? TEXT.note.radio : TEXT.note.logOnly;
    }
}
