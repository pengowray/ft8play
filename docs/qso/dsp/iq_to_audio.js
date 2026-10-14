// IQ samples from an SDR to upper-sideband audio at 12 kHz, as a radio set to USB would give.
//
// The SDR is tuned offsetHz above the dial frequency (keeping the SDR's DC spike out of the
// audio). Steps:
//   1. Remove DC; mix so that dial + 1600 Hz (the middle of the FT8 audio band) is at 0 Hz.
//   2. Decimate to 48 kHz, then to 12 kHz (windowed-sinc low-pass filters).
//   3. Complex low-pass to +-1500 Hz at 12 kHz: keeps audio 100 to 3100 Hz above the dial and
//      removes the lower sideband, which would otherwise fold into the audio.
//   4. Mix back up by 1600 Hz and take the real part.

/** Windowed-sinc (Blackman) low-pass filter taps, normalised to unity gain at DC. */
export function lowpassTaps(numTaps, cutoffHz, sampleRate) {
    const taps = new Float64Array(numTaps);
    const m = (numTaps - 1) / 2;
    const fc = cutoffHz / sampleRate;
    let sum = 0;
    for (let n = 0; n < numTaps; n++) {
        const x = n - m;
        const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
        const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * n / (numTaps - 1)) + 0.08 * Math.cos(4 * Math.PI * n / (numTaps - 1));
        taps[n] = sinc * w;
        sum += taps[n];
    }
    for (let n = 0; n < numTaps; n++) taps[n] /= sum;
    return taps;
}

/** Odd tap count for a Blackman window with the given transition width. */
function tapsFor(transitionHz, sampleRate) {
    const n = Math.ceil(5.5 * sampleRate / transitionHz);
    return n % 2 ? n : n + 1;
}

/** FIR filter on complex samples that keeps every `decimation`-th output. */
class DecimatingFir {
    constructor(taps, decimation) {
        this.taps = taps;
        this.decimation = decimation;
        this.n = taps.length;
        // History doubled so a window of n samples is always contiguous.
        this.re = new Float64Array(2 * this.n);
        this.im = new Float64Array(2 * this.n);
        this.pos = 0;
        this.phase = 0;
    }

    /** @returns {{re: Float64Array, im: Float64Array}} */
    process(inRe, inIm, length = inRe.length) {
        const { taps, n, decimation } = this;
        const outRe = new Float64Array(Math.ceil((length + this.phase) / decimation) + 1);
        const outIm = new Float64Array(outRe.length);
        let count = 0;
        for (let i = 0; i < length; i++) {
            this.re[this.pos] = this.re[this.pos + n] = inRe[i];
            this.im[this.pos] = this.im[this.pos + n] = inIm[i];
            this.pos = (this.pos + 1) % n;
            if (++this.phase === decimation) {
                this.phase = 0;
                // Oldest sample is at pos; window is re[pos .. pos+n-1].
                let sr = 0, si = 0;
                const start = this.pos;
                for (let k = 0; k < n; k++) {
                    const t = taps[n - 1 - k];
                    sr += t * this.re[start + k];
                    si += t * this.im[start + k];
                }
                outRe[count] = sr;
                outIm[count] = si;
                count++;
            }
        }
        return { re: outRe.subarray(0, count), im: outIm.subarray(0, count) };
    }
}

/** Complex oscillator e^(j 2 pi f t), advanced sample by sample. */
class Mixer {
    constructor(freqHz, sampleRate) {
        this.step = 2 * Math.PI * freqHz / sampleRate;
        this.phase = 0;
    }
    /** Multiplies re/im in place by the oscillator. */
    mix(re, im, length = re.length) {
        let c = Math.cos(this.phase), s = Math.sin(this.phase);
        const cs = Math.cos(this.step), ss = Math.sin(this.step);
        for (let i = 0; i < length; i++) {
            const r = re[i], q = im[i];
            re[i] = r * c - q * s;
            im[i] = r * s + q * c;
            const c2 = c * cs - s * ss;
            s = c * ss + s * cs;
            c = c2;
        }
        this.phase = (this.phase + this.step * length) % (2 * Math.PI);
    }
}

const PASSBAND_CENTRE_HZ = 1600;
const HALF_WIDTH_HZ = 1500;

export class IqToUsbAudio {
    /**
     * @param {{inputRate: number, offsetHz: number, outputRate?: number}} options
     *   inputRate: IQ sample rate, a multiple of 4 * outputRate (e.g. 240000)
     *   offsetHz: SDR centre frequency minus the dial frequency
     */
    constructor({ inputRate, offsetHz, outputRate = 12000 }) {
        const mid = 4 * outputRate;
        if (inputRate % mid !== 0) throw new Error(`IQ sample rate must be a multiple of ${mid} Hz`);
        this.inputRate = inputRate;
        this.outputRate = outputRate;
        this.dcRe = 0;
        this.dcIm = 0;
        // Dial + 1600 Hz is at (1600 - offset) Hz in the IQ samples; move it to 0.
        this.inMixer = new Mixer(-(PASSBAND_CENTRE_HZ - offsetHz), inputRate);
        const d1 = inputRate / mid;
        this.stage1 = d1 > 1 ? new DecimatingFir(lowpassTaps(tapsFor(mid - 2 * 8000, inputRate), 8000, inputRate), d1) : null;
        this.stage2 = new DecimatingFir(lowpassTaps(tapsFor(outputRate - 2 * 3000, mid), 3000, mid), 4);
        this.stage3 = new DecimatingFir(lowpassTaps(tapsFor(200, outputRate), HALF_WIDTH_HZ, outputRate), 1);
        this.outMixer = new Mixer(PASSBAND_CENTRE_HZ, outputRate);
    }

    /**
     * @param {Uint8Array} iq interleaved unsigned 8-bit I and Q, as an RTL-SDR sends them
     * @returns {Float32Array} audio at outputRate
     */
    processU8(iq) {
        const n = iq.length >> 1;
        const re = new Float64Array(n), im = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            re[i] = (iq[2 * i] - 127.5) / 127.5;
            im[i] = (iq[2 * i + 1] - 127.5) / 127.5;
        }
        return this.process(re, im);
    }

    /**
     * @param {Float64Array} re in-phase samples (modified in place)
     * @param {Float64Array} im quadrature samples (modified in place)
     * @returns {Float32Array} audio at outputRate
     */
    process(re, im) {
        const n = re.length;
        // Slow DC removal (time constant about 0.1 s).
        const a = 1 / (0.1 * this.inputRate);
        for (let i = 0; i < n; i++) {
            this.dcRe += a * (re[i] - this.dcRe);
            this.dcIm += a * (im[i] - this.dcIm);
            re[i] -= this.dcRe;
            im[i] -= this.dcIm;
        }
        this.inMixer.mix(re, im, n);
        let x = this.stage1 ? this.stage1.process(re, im, n) : { re, im };
        x = this.stage2.process(x.re, x.im);
        x = this.stage3.process(x.re, x.im);
        const outRe = Float64Array.from(x.re), outIm = Float64Array.from(x.im);
        this.outMixer.mix(outRe, outIm);
        return Float32Array.from(outRe);
    }
}
