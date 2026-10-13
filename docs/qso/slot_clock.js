// The one place that says what time it is and which slot we are in.
//
// Time = device clock + offset. The offset corrects the device clock, and comes from one of:
//   - decodes: if received signals consistently arrive with DT = +0.3 s, this clock is
//     0.3 s ahead of the stations being received, so the offset moves back by 0.3 s.
//     (This also absorbs the audio input delay, which is what matters for receiving.)
//   - manual: set by the user.
// No DOM use; `now` can be replaced for tests.

import { MODES } from './modes.js';

export const OFFSET_SOURCE = { NONE: 'none', MANUAL: 'manual', DECODES: 'decodes' };

const DT_HISTORY_SLOTS = 4;     // use decodes from this many recent slots
const DT_MIN_DECODES = 5;       // need at least this many decodes before correcting
const DT_DEADBAND_S = 0.05;     // ignore smaller median DT
const DT_CORRECTION_GAIN = 0.7; // move this fraction of the way each time, to avoid overshoot

export class SlotClock {
    /**
     * @param {{mode?: object, now?: () => number}} options now() returns device time in ms (default Date.now)
     */
    constructor({ mode = MODES.FT8, now = () => Date.now() } = {}) {
        this.mode = mode;
        this.deviceNow = now;
        this.offsetMs = 0;
        this.offsetSource = OFFSET_SOURCE.NONE;
        this.autoCorrect = true;
        this.dtHistory = []; // { slot, dts: number[] }
    }

    get slotMs() {
        return this.mode.slotSeconds * 1000;
    }

    /** Corrected time in ms since the Unix epoch. */
    now() {
        return this.deviceNow() + this.offsetMs;
    }

    /** Slot number: slots are counted from the Unix epoch, so they line up with UTC. */
    slotIndex(t = this.now()) {
        return Math.floor(t / this.slotMs);
    }

    slotStart(index) {
        return index * this.slotMs;
    }

    /** Seconds since the start of the slot containing t. */
    secondsIntoSlot(t = this.now()) {
        return (t - this.slotStart(this.slotIndex(t))) / 1000;
    }

    /**
     * WSJT-X's "even" (first) slots start at 00 and 30 s past the minute for FT8; "odd" (second)
     * slots at 15 and 45 s. Because 60 s is a whole number of slots, slot index parity matches.
     */
    isEvenSlot(index) {
        return index % 2 === 0;
    }

    /** Time of the next slot boundary after t, and that slot's index. */
    nextSlot(t = this.now()) {
        const index = this.slotIndex(t) + 1;
        return { index, start: this.slotStart(index) };
    }

    /** Device time (ms) corresponding to a corrected time, e.g. to schedule audio. */
    toDeviceTime(t) {
        return t - this.offsetMs;
    }

    setManualOffset(ms) {
        this.offsetMs = ms;
        this.offsetSource = ms === 0 ? OFFSET_SOURCE.NONE : OFFSET_SOURCE.MANUAL;
        this.dtHistory = [];
    }

    /**
     * Records the DTs (seconds) of one slot's decodes and, when there are enough, corrects
     * the offset. Returns the correction applied in ms (0 if none).
     */
    addSlotDts(slot, dts) {
        this.dtHistory.push({ slot, dts: [...dts] });
        this.dtHistory = this.dtHistory.filter(h => h.slot > slot - DT_HISTORY_SLOTS);
        if (!this.autoCorrect || this.offsetSource === OFFSET_SOURCE.MANUAL) return 0;

        const all = this.dtHistory.flatMap(h => h.dts).sort((a, b) => a - b);
        if (all.length < DT_MIN_DECODES) return 0;
        const median = all[Math.floor(all.length / 2)];
        if (Math.abs(median) < DT_DEADBAND_S) return 0;

        const correctionMs = -median * 1000 * DT_CORRECTION_GAIN;
        this.offsetMs += correctionMs;
        this.offsetSource = OFFSET_SOURCE.DECODES;
        // The stored DTs were measured with the old offset; start again.
        this.dtHistory = [];
        return correctionMs;
    }
}
