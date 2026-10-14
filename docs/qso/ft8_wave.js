// FT8 tones and waveform, in plain JS (no wasm), for transmitting and for test signals.

import { ftx_compute_crc, binary91ToSymbols } from '../ft8_checks.js';
import { bitsToPacked } from '../ft8_convert.js';

/**
 * The 79 tones (0 to 7) for 77 message bits: 14-bit CRC, LDPC (174,91) parity, Gray code
 * and Costas sync, as WSJT-X's genft8 does.
 * @param {string} bits77 77 characters of '0'/'1'
 * @returns {Uint8Array}
 */
export function bitsToTones(bits77) {
    // CRC over the 77 bits followed by 5 zero bits (82 bits), as ftx_add_crc does.
    const bytes = new Uint8Array(12);
    bytes.set(bitsToPacked(bits77).slice(0, 10));
    const crc = ftx_compute_crc(bytes, 82);
    const symbols = binary91ToSymbols(bits77 + crc.toString(2).padStart(14, '0'));
    return Uint8Array.from(symbols, (c) => c.charCodeAt(0) - 48);
}

function erf(x) {
    // Abramowitz and Stegun 7.1.26 (error below 1.5e-7), enough for pulse shaping.
    const sign = Math.sign(x);
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
}

// gfsk_pulse.f90
function gfskPulse(bt, t) {
    const c = Math.PI * Math.sqrt(2 / Math.log(2));
    return 0.5 * (erf(c * bt * (t + 0.5)) - erf(c * bt * (t - 0.5)));
}

/**
 * FT8 audio for 79 tones, as WSJT-X's gen_ft8wave.f90 makes it: Gaussian-smoothed frequency
 * steps (BT 2.0), a dummy symbol before and after so the first and last tones are smoothed
 * too, and a raised-cosine ramp over 1/8 of a symbol at each end.
 * @param {ArrayLike<number>} tones 79 tones
 * @param {{sampleRate?: number, f0?: number, bt?: number, symbolSeconds?: number, amplitude?: number, complex?: boolean}} options
 *   f0 is the frequency of tone 0 in Hz (may be negative when complex).
 *   complex: also return the quadrature part, for IQ signals (gen_ft8wave's icmplx=1).
 * @returns {Float32Array|{re: Float32Array, im: Float32Array}} tones.length * samples-per-symbol samples
 */
export function genFt8Wave(tones, { sampleRate = 48000, f0 = 1500, bt = 2.0, symbolSeconds = 0.16, amplitude = 1, complex = false } = {}) {
    const nsym = tones.length;
    const nsps = Math.round(sampleRate * symbolSeconds);
    const twopi = 2 * Math.PI;

    const pulse = new Float64Array(3 * nsps);
    for (let i = 0; i < 3 * nsps; i++) pulse[i] = gfskPulse(bt, (i + 1 - 1.5 * nsps) / nsps);

    const dphiPeak = twopi / nsps; // modulation index 1
    const dphi = new Float64Array((nsym + 2) * nsps);
    for (let j = 0; j < nsym; j++) {
        const ib = j * nsps;
        for (let i = 0; i < 3 * nsps; i++) dphi[ib + i] += dphiPeak * pulse[i] * tones[j];
    }
    // Dummy symbols at the start and end, with the first and last tones.
    for (let i = 0; i < 2 * nsps; i++) {
        dphi[i] += dphiPeak * tones[0] * pulse[nsps + i];
        dphi[nsym * nsps + i] += dphiPeak * tones[nsym - 1] * pulse[i];
    }
    const carrier = twopi * f0 / sampleRate;

    const nwave = nsym * nsps;
    const wave = new Float32Array(nwave);
    const quad = complex ? new Float32Array(nwave) : null;
    let phi = 0;
    for (let k = 0; k < nwave; k++) {
        wave[k] = amplitude * Math.sin(phi);
        if (quad) quad[k] = -amplitude * Math.cos(phi); // sin - j cos = -j e^(j phi): analytic signal
        phi = (phi + dphi[nsps + k] + carrier) % twopi;
    }

    const nramp = Math.round(nsps / 8);
    for (let i = 0; i < nramp; i++) {
        const up = (1 - Math.cos(twopi * i / (2 * nramp))) / 2;
        const down = (1 + Math.cos(twopi * i / (2 * nramp))) / 2;
        wave[i] *= up;
        wave[nwave - nramp + i] *= down;
        if (quad) {
            quad[i] *= up;
            quad[nwave - nramp + i] *= down;
        }
    }
    return quad ? { re: wave, im: quad } : wave;
}

/**
 * Streaming FT8 generator: the same waveform as genFt8Wave (complex), produced a block at a
 * time, for long or high-rate signals such as simulated SDR IQ. Call fill() with consecutive
 * sample ranges.
 */
export class Ft8Synth {
    /**
     * @param {ArrayLike<number>} tones 79 tones
     * @param {{sampleRate: number, f0: number, amplitude?: number, bt?: number, symbolSeconds?: number}} options
     */
    constructor(tones, { sampleRate, f0, amplitude = 1, bt = 2.0, symbolSeconds = 0.16 }) {
        this.tones = tones;
        this.nsym = tones.length;
        this.nsps = Math.round(sampleRate * symbolSeconds);
        this.pulse = new Float64Array(3 * this.nsps);
        for (let i = 0; i < 3 * this.nsps; i++) this.pulse[i] = gfskPulse(bt, (i + 1 - 1.5 * this.nsps) / this.nsps);
        this.dphiPeak = 2 * Math.PI / this.nsps;
        this.carrier = 2 * Math.PI * f0 / sampleRate;
        this.amplitude = amplitude;
        this.length = this.nsym * this.nsps;
        this.nramp = Math.round(this.nsps / 8);
        this.phi = 0;
        this.next = 0; // next sample index to generate
    }

    // Phase step for output sample k (dphi[nsps + k] in gen_ft8wave.f90).
    dphi(k) {
        const { nsps, nsym, pulse, tones } = this;
        const i = nsps + k;
        let d = 0;
        const jc = Math.floor(i / nsps);
        for (let j = jc - 2; j <= jc; j++) {
            if (j < 0 || j >= nsym) continue;
            const p = i - j * nsps;
            if (p >= 0 && p < 3 * nsps) d += pulse[p] * tones[j];
        }
        if (i < 2 * nsps) d += tones[0] * pulse[nsps + i];
        if (i >= nsym * nsps) d += tones[nsym - 1] * pulse[i - nsym * nsps];
        return d * this.dphiPeak + this.carrier;
    }

    /** Adds samples [from, from + count) of the signal into re/im starting at index `at`. */
    addTo(re, im, at, from, count) {
        const twopi = 2 * Math.PI;
        while (this.next < from) { this.phi = (this.phi + this.dphi(this.next)) % twopi; this.next++; }
        for (let n = 0; n < count; n++) {
            const k = from + n;
            if (k >= this.length) break;
            if (k >= 0) {
                let a = this.amplitude;
                if (k < this.nramp) a *= (1 - Math.cos(twopi * k / (2 * this.nramp))) / 2;
                else if (k >= this.length - this.nramp) a *= (1 + Math.cos(twopi * (k - this.length + this.nramp) / (2 * this.nramp))) / 2;
                re[at + n] += a * Math.sin(this.phi);
                im[at + n] -= a * Math.cos(this.phi);
                this.phi = (this.phi + this.dphi(k)) % twopi;
                this.next = k + 1;
            }
        }
    }
}
