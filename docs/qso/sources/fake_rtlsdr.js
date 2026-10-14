// A pretend RTL-SDR for testing the RTL-SDR input without hardware (open the page with
// ?fake-rtlsdr). It produces IQ in real time: noise, plus the test-signal stations placed
// around the FT8 dial frequency that is closest to the tuned frequency, plus one station
// on the lower sideband (which a correct USB receiver doesn't show).

import { PackJT77, fmtmsg, genft8Message } from '../../wsjtx/packjt77.js';
import { bitsToTones, Ft8Synth } from '../ft8_wave.js';
import { SCRIPT, FREQS } from './test_signals.js';

export class FakeRtlProvider {
    constructor({ clock }) {
        this.clock = clock;
    }
    async get() {
        return new FakeRtlDevice(this.clock);
    }
}

class FakeRtlDevice {
    constructor(clock) {
        this.clock = clock;
        this.rate = 240000;
        this.center = 14094000;
        this.gain = null;
        this.directSampling = false;
        this.packer = new PackJT77();
        this.seed = 99;
        this.sent = null;          // corrected time (ms) up to which samples have been produced
        this.slotSignals = new Map();
        this.tuner = { isRtlSdrBlogV4: false };
    }
    async setSampleRate(rate) { this.rate = rate; return rate; }
    async setFrequencyCorrection() {}
    getFrequencyCorrection() { return 0; }
    async setDirectSamplingMethod() {}
    getDirectSamplingMethod() { return 2; }
    async setGain(g) { this.gain = g; }
    getGain() { return this.gain; }
    async setCenterFrequency(f) { this.center = f; this.slotSignals.clear(); return f; }
    async enableBiasTee() {}
    isBiasTeeEnabled() { return false; }
    async resetBuffer() { this.sent = null; }
    async close() {}

    random() {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return (this.seed + 0.5) / 4294967296;
    }

    /** Signals for a slot: [{ synth, startSample }] with frequencies relative to the tuned centre. */
    signalsFor(slot) {
        if (this.slotSignals.has(slot)) return this.slotSignals.get(slot);
        const dial = this.center - 20000;
        const parity = this.clock.isEvenSlot(slot) ? 'even' : 'odd';
        const step = Math.floor(slot / 2) % 4;
        const list = [];
        const add = (text, audioHz, snrDb, dt) => {
            const r = genft8Message(this.packer, fmtmsg(text.padEnd(37)));
            if (!r.success) return;
            const noiseIn2500 = 2 * 0.03 * 0.03 * 2500 / this.rate;
            const amplitude = Math.sqrt(noiseIn2500 * Math.pow(10, snrDb / 10));
            list.push({
                synth: new Ft8Synth(bitsToTones(r.c77), { sampleRate: this.rate, f0: dial + audioHz - this.center, amplitude }),
                startSample: Math.round((0.5 + dt) * this.rate),
            });
        };
        SCRIPT[parity].forEach((lines, i) => add(lines[step], FREQS[parity][i], -20 + this.random() * 28, -0.3 + this.random() * 0.8));
        add('CQ LSB SIDE', -1200, 5, 0); // lower sideband: must not appear
        this.slotSignals.set(slot, list);
        for (const s of this.slotSignals.keys()) if (s < slot - 1) this.slotSignals.delete(s);
        return list;
    }

    async readSamples(length) {
        const ms = length / this.rate * 1000;
        if (this.sent == null) this.sent = this.clock.now() - ms;
        // Pace to real time.
        const wait = this.sent + ms - this.clock.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait));

        const re = new Float64Array(length), im = new Float64Array(length);
        for (let i = 0; i < length; i++) {
            const r = Math.sqrt(-2 * Math.log(this.random())) * 0.03, a = 2 * Math.PI * this.random();
            re[i] = r * Math.cos(a);
            im[i] = r * Math.sin(a);
        }
        // Add the signals of the slot(s) this block overlaps.
        let t = this.sent;
        let done = 0;
        while (done < length) {
            const slot = this.clock.slotIndex(t);
            const slotStart = this.clock.slotStart(slot);
            const first = Math.round((t - slotStart) / 1000 * this.rate);
            const untilSlotEnd = Math.round((this.clock.slotStart(slot + 1) - t) / 1000 * this.rate);
            const n = Math.max(1, Math.min(length - done, untilSlotEnd));
            for (const s of this.signalsFor(slot)) s.synth.addTo(re, im, done, first - s.startSample, n);
            done += n;
            t += n / this.rate * 1000;
        }
        this.sent += ms;

        const data = new Uint8Array(length * 2);
        for (let i = 0; i < length; i++) {
            data[2 * i] = Math.max(0, Math.min(255, Math.round(re[i] * 127.5 + 127.5)));
            data[2 * i + 1] = Math.max(0, Math.min(255, Math.round(im[i] * 127.5 + 127.5)));
        }
        return { frequency: this.center, directSampling: false, data: data.buffer };
    }
}
