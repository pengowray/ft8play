// The clock bar at the top of the page: UTC time, progress through the current slot, and
// the clock correction.

import { OFFSET_SOURCE } from '../slot_clock.js';
import { utcTime } from '../band_activity.js';
import { $ } from './dom.js';

export class ClockDisplay {
    /** @param {import('../slot_clock.js').SlotClock} clock */
    constructor(clock) {
        this.clock = clock;
        this.fill = document.querySelector('.slot-fill');
        this.bar = document.querySelector('.slot-bar');
        const decodeMark = document.querySelector('.slot-decode');
        decodeMark.style.left = `${(clock.mode.decodeAtSeconds / clock.mode.slotSeconds * 100).toFixed(1)}%`;
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
        $('clock-offset').textContent = clock.offsetSource === OFFSET_SOURCE.NONE
            ? 'Clock: computer time'
            : `Clock: computer time ${offset >= 0 ? '+' : '−'}${Math.abs(offset).toFixed(2)} s (${clock.offsetSource === OFFSET_SOURCE.DECODES ? 'from decoded messages' : 'set manually'})`;
    }
}
