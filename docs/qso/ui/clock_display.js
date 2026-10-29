// The clock bar at the top of the page: UTC time, progress through the current slot, and
// the clock correction, which opens a popover to choose automatic or manual correction.
// A manual correction is remembered in this browser; automatic correction starts from 0.

import { OFFSET_SOURCE } from '../slot_clock.js';
import { utcTime } from '../band_activity.js';
import { $, store } from './dom.js';

const signed = (s) => `${s >= 0 ? '+' : '−'}${Math.abs(s).toFixed(2)} s`;

const TEXT = {
    none: 'Clock: computer time',
    auto: (s) => `Clock: computer time ${signed(s)} (auto)`,
    manual: (s) => s === 0 ? 'Clock: computer time (manual)' : `Clock: computer time ${signed(s)} (manual)`,
    autoNow: (s) => `Current correction: ${signed(s)}`,
};

export class ClockDisplay {
    /** @param {import('../slot_clock.js').SlotClock} clock */
    constructor(clock) {
        this.clock = clock;
        this.fill = document.querySelector('.slot-fill');
        this.bar = document.querySelector('.slot-bar');
        const decodeMark = document.querySelector('.slot-decode');
        decodeMark.style.left = `${(clock.mode.decodeAtSeconds / clock.mode.slotSeconds * 100).toFixed(1)}%`;
        this.setUpCorrection();
    }

    setUpCorrection() {
        const { clock } = this;
        const manual = $('clock-manual');
        const popover = $('clock-popover');
        const radios = document.querySelectorAll('input[name="clock-mode"]');
        const mode = () => document.querySelector('input[name="clock-mode"]:checked')?.value;
        const applyManual = () => {
            const s = Math.max(-30, Math.min(30, Number(manual.value) || 0));
            manual.value = s.toFixed(2);
            store.set('clockManual', manual.value);
            clock.setManualOffset(s * 1000);
        };
        const apply = () => {
            store.set('clockMode', mode());
            if (mode() === 'manual') applyManual(); else clock.useAutomatic();
            this.renderCorrection();
        };

        manual.value = Number(store.get('clockManual', '0')).toFixed(2);
        const saved = store.get('clockMode', 'auto') === 'manual' ? 'manual' : 'auto';
        radios.forEach((r) => { r.checked = r.value === saved; r.addEventListener('change', apply); });
        if (saved === 'manual') applyManual();
        // Typing a correction chooses Manual.
        manual.addEventListener('focus', () => { if (mode() !== 'manual') { radios.forEach((r) => { r.checked = r.value === 'manual'; }); apply(); } });
        manual.addEventListener('change', apply);
        $('clock-reset').addEventListener('click', () => clock.useAutomatic());

        // Popovers open in the middle of the screen; place this one under the clock status.
        popover.addEventListener('beforetoggle', (e) => {
            if (e.newState !== 'open') return;
            const r = $('clock-offset').getBoundingClientRect();
            const width = document.documentElement.clientWidth; // without the scrollbar
            popover.style.top = `${r.bottom + 4}px`;
            popover.style.left = `${Math.max(16, Math.min(r.left, width - Math.min(360, width - 32) - 16))}px`;
            manual.value = (mode() === 'manual' ? clock.offsetMs / 1000 : Number(manual.value)).toFixed(2);
            this.renderCorrection();
        });
        this.renderCorrection();
    }

    renderCorrection() {
        const { clock } = this;
        $('clock-auto-row').hidden = !clock.autoCorrect;
        $('clock-auto-now').textContent = TEXT.autoNow(clock.offsetMs / 1000);
        $('clock-reset').disabled = clock.offsetMs === 0;
    }

    /** Called about 10 times a second. */
    render() {
        const { clock } = this;
        const now = clock.now();
        $('utc').textContent = utcTime(now);
        const into = clock.secondsIntoSlot(now);
        this.fill.style.width = `${(into / clock.mode.slotSeconds * 100).toFixed(1)}%`;
        this.bar.setAttribute('aria-valuenow', into.toFixed(0));
        $('slot-label').textContent = `${clock.isEvenSlot(clock.slotIndex(now)) ? 'Even' : 'Odd'} slot · ${into.toFixed(1)} of ${clock.mode.slotSeconds} s`;
        const offset = clock.offsetMs / 1000;
        const text = clock.offsetSource === OFFSET_SOURCE.MANUAL ? TEXT.manual(offset)
            : clock.offsetSource === OFFSET_SOURCE.DECODES ? TEXT.auto(offset)
            : TEXT.none;
        const button = $('clock-offset');
        if (button.textContent !== text) button.textContent = text;
        if ($('clock-popover').matches(':popover-open')) this.renderCorrection();
    }
}
