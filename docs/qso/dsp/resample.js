// Sample rate conversion for real audio by any ratio, such as 44.1 or 48 kHz sound card input
// to the decoder's 12 kHz.
//
// Bandlimited interpolation (J. O. Smith): each output sample is the sum of the nearby input
// samples, weighted by a windowed-sinc low-pass filter centred on the output sample's position.
// The filter is tabulated at PHASES points per input sample, and taps between table points
// are found by linear interpolation. Each output position is kept as a whole number of input
// samples plus a remainder in units of 1 / outRate, so for whole-number rates it is exact and
// the output never drifts.
//
// Output sample m is the input signal at input sample m * inRate / outRate, counting from the
// first input sample, so the output is not shifted in time. It can only be computed once input
// half a filter length later has arrived, so each call returns output that starts a little
// before its input chunk: see outputOffset.

import { lowpassTaps } from './iq_to_audio.js';

const PHASES = 256;

export class Resampler {
    /**
     * @param {number} inRate input sample rate (Hz)
     * @param {number} outRate output sample rate (Hz)
     * @param {{passHz?: number, stopHz?: number}} [options] filter band edges. Defaults: passband
     *   up to a third of the lower rate, stopband from half of it (4 and 6 kHz for 12 kHz output).
     */
    constructor(inRate, outRate, { passHz, stopHz } = {}) {
        this.inRate = inRate;
        this.outRate = outRate;
        const low = Math.min(inRate, outRate);
        stopHz ??= low / 2;
        passHz ??= low / 3;
        // A Blackman windowed sinc of n taps has a transition band about 5.5 / n of the sample rate wide.
        const n = inRate === outRate ? 0 : 2 * Math.ceil(5.5 * inRate / (stopHz - passHz) / 2);
        this.numTaps = n;
        /** Seconds from an output sample's time until the input needed to compute it has arrived. */
        this.latency = n / 2 / inRate;
        /**
         * Time of the first output sample of the last process() call minus the time of the first
         * input sample of that call, in seconds. Negative after the first call: each call's output
         * starts up to `latency` before its input.
         */
        this.outputOffset = 0;

        // Position of the next output sample, relative to the start of the next input chunk:
        // pos + num / outRate input samples.
        this.pos = 0;
        this.num = 0;
        this.step = Math.floor(inRate / outRate);
        this.stepNum = inRate - this.step * outRate;
        this.history = new Float64Array(n); // the last n input samples (zeros before the first)

        if (n === 0) return;
        // Prototype filter at PHASES times the input rate: index j is at (j - n * PHASES / 2) / PHASES
        // input samples from the output position. Scaled for unity gain at the input rate.
        const h = lowpassTaps(n * PHASES + 1, (passHz + stopHz) / 2, inRate * PHASES);
        // Row q (fraction q / PHASES) holds the taps for inputs from n/2 - 1 samples before the
        // output position to n/2 after it, and the slope to the next row for interpolation.
        this.taps = new Float32Array(PHASES * n);
        this.slopes = new Float32Array(PHASES * n);
        for (let q = 0; q < PHASES; q++) {
            for (let i = 0; i < n; i++) {
                const j = q + (n - 1 - i) * PHASES;
                this.taps[q * n + i] = h[j] * PHASES;
                this.slopes[q * n + i] = (h[j + 1] - h[j]) * PHASES;
            }
        }
    }

    /**
     * @param {Float32Array} input the next input samples
     * @returns {Float32Array} all the output samples that can be computed so far
     */
    process(input) {
        const len = input.length;
        if (this.numTaps === 0) {
            this.outputOffset = 0;
            return Float32Array.from(input);
        }
        const { numTaps: n, taps, slopes, inRate, outRate, step, stepNum } = this;
        const half = n / 2;
        let pos = this.pos, num = this.num;
        this.outputOffset = (pos + num / outRate) / inRate;

        // buf[n + k] is input sample k of this chunk; negative k are from earlier chunks.
        const buf = new Float64Array(n + len);
        buf.set(this.history);
        buf.set(input, n);
        const out = new Float32Array(Math.max(0, Math.ceil((len - half - pos) * outRate / inRate) + 1));
        let count = 0;
        while (pos + half < len) {
            const x = num * PHASES / outRate;
            const q = Math.floor(x), frac = x - q;
            const row = q * n;
            const start = n + pos - half + 1;
            let sum = 0;
            for (let i = 0; i < n; i++) sum += taps[row + i] * buf[start + i];
            if (frac > 0) {
                let slope = 0;
                for (let i = 0; i < n; i++) slope += slopes[row + i] * buf[start + i];
                sum += frac * slope;
            }
            out[count++] = sum;
            pos += step;
            num += stepNum;
            if (num >= outRate) { num -= outRate; pos++; }
        }
        this.history.set(buf.subarray(len));
        this.pos = pos - len;
        this.num = num;
        return out.subarray(0, count);
    }
}
