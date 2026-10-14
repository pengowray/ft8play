// Test signals: simulated FT8 stations in white noise, streamed in real time like a live
// receiver, so the whole receive path (slot timing, waterfall, decoding) can be tried without
// a radio. Each slot carries a few stations from a scripted band, at fixed frequencies and
// random SNR and DT.

import { PackJT77, fmtmsg, genft8Message } from '../../wsjtx/packjt77.js';
import { bitsToTones, genFt8Wave } from '../ft8_wave.js';

// Two QSOs in progress plus some CQs. Even and odd slots carry different stations, as on air.
// Example callsigns in the style of the WSJT-X documentation.
const SCRIPT = {
    even: [
        ['CQ K1ABC FN42', 'W9XYZ K1ABC -11', 'W9XYZ K1ABC RR73', 'CQ K1ABC FN42'],
        ['CQ DX PA9XYZ JO22', 'CQ DX PA9XYZ JO22', 'KA1ABC PA9XYZ -05', 'KA1ABC PA9XYZ RR73'],
        ['CQ POTA G4ABC IO91', 'CQ POTA G4ABC IO91', 'CQ POTA G4ABC IO91', 'CQ POTA G4ABC IO91'],
    ],
    odd: [
        ['K1ABC W9XYZ EN37', 'K1ABC W9XYZ R-09', 'K1ABC W9XYZ 73', 'CQ W9XYZ EN37'],
        ['PA9XYZ KA1ABC FN43', 'PA9XYZ KA1ABC R-12', 'PA9XYZ KA1ABC 73', 'CQ KA1ABC FN43'],
        ['CQ WB9XYZ EN52', 'CQ WB9XYZ EN52', 'G4ABC WB9XYZ -17', 'G4ABC WB9XYZ RR73'],
    ],
};
const FREQS = { even: [800, 1450, 2100], odd: [1100, 1720, 2450] };

export class TestSignalSource {
    /**
     * @param {{clock: import('../slot_clock.js').SlotClock, onAudio: (samples: Float32Array, startTime: number) => void,
     *          noiseLevel?: number}} options
     */
    constructor({ clock, onAudio, noiseLevel = 0.02 }) {
        this.clock = clock;
        this.onAudio = onAudio;
        this.sampleRate = clock.mode.sampleRate;
        this.noiseSigma = noiseLevel;
        this.packer = new PackJT77();
        this.timer = null;
        this.slotAudio = new Map(); // slot index -> Float32Array
        this.sentUntil = null;      // corrected time (ms) up to which audio has been sent
        this.seed = 12345;
        this.level = -Infinity;     // peak level of the last chunk, dBFS
    }

    get running() {
        return this.timer != null;
    }

    start() {
        if (this.timer) return;
        this.sentUntil = this.clock.now();
        this.timer = setInterval(() => this.tick(), 100);
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
        this.slotAudio.clear();
    }

    tick() {
        const now = this.clock.now();
        const msPerSample = 1000 / this.sampleRate;
        while (this.sentUntil < now) {
            const slot = this.clock.slotIndex(this.sentUntil);
            const audio = this.audioFor(slot);
            const from = Math.round((this.sentUntil - this.clock.slotStart(slot)) / msPerSample);
            const to = Math.min(audio.length, Math.round((now - this.clock.slotStart(slot)) / msPerSample));
            if (to <= from) {
                this.sentUntil = this.clock.slotStart(slot + 1);
                continue;
            }
            const chunk = audio.subarray(from, to);
            let peak = 0;
            for (const v of chunk) peak = Math.max(peak, Math.abs(v));
            this.level = 20 * Math.log10(peak || 1e-9);
            this.onAudio(chunk, this.clock.slotStart(slot) + from * msPerSample);
            this.sentUntil = this.clock.slotStart(slot) + to * msPerSample;
            if (to >= audio.length) this.sentUntil = this.clock.slotStart(slot + 1);
        }
        for (const s of this.slotAudio.keys()) if (s < this.clock.slotIndex(now) - 1) this.slotAudio.delete(s);
    }

    random() {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return (this.seed + 0.5) / 4294967296;
    }

    audioFor(slot) {
        if (this.slotAudio.has(slot)) return this.slotAudio.get(slot);
        const n = this.clock.mode.slotSeconds * this.sampleRate;
        const audio = new Float32Array(n);
        // White noise; its power in 2500 Hz sets the SNR scale.
        for (let i = 0; i < n; i += 2) {
            const r = Math.sqrt(-2 * Math.log(this.random())), a = 2 * Math.PI * this.random();
            audio[i] = this.noiseSigma * r * Math.cos(a);
            if (i + 1 < n) audio[i + 1] = this.noiseSigma * r * Math.sin(a);
        }
        const noisePower2500 = this.noiseSigma ** 2 * 2500 / (this.sampleRate / 2);

        const parity = this.clock.isEvenSlot(slot) ? 'even' : 'odd';
        const step = Math.floor(slot / 2) % 4;
        SCRIPT[parity].forEach((lines, i) => {
            const text = lines[step];
            const r = genft8Message(this.packer, fmtmsg(text.padEnd(37)));
            if (!r.success) return;
            const snrDb = -22 + this.random() * 30;
            const dt = -0.3 + this.random() * 0.8;
            const amplitude = Math.sqrt(2 * noisePower2500 * Math.pow(10, snrDb / 10));
            const wave = genFt8Wave(bitsToTones(r.c77), { sampleRate: this.sampleRate, f0: FREQS[parity][i], amplitude });
            const start = Math.round((this.clock.mode.txStartSeconds + dt) * this.sampleRate);
            for (let k = 0; k < wave.length; k++) {
                const j = start + k;
                if (j >= 0 && j < n) audio[j] += wave[k];
            }
        });
        this.slotAudio.set(slot, audio);
        return audio;
    }
}
