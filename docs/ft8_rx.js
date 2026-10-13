// Streaming FT8 receiver, using ft8_lib's decoder (rxft8_* functions in ft8lib/ft8_wasm.wasm).
// No DOM use: runs in a page, a worker or node.
//
// Feed 12 kHz audio one block (one symbol, 1920 samples) at a time from the start of a slot,
// read waterfall rows as they arrive, and call decode() near the end of the slot.
// Results carry the 77 message bits; unpack them with the WSJT-X port (wsjtx/packjt77.js).

import createFt8libModule from './ft8lib/ft8_wasm.js';

const RESULT_SIZE = 28; // sizeof(rxft8_result_t) in wasm/src/rxft8.c
const SNR_BASELINE_BINS = 32; // noise baseline taken within this many bins (6.25 Hz each) of the signal
// Correction added to the estimate. 0 gives the true SNR for synthetic signals in white noise
// (SNR defined as in WSJT-X's ft8sim). WSJT-X 2.1 logs of ft8_lib's test recordings (2019)
// report about 6.4 dB lower; whether current WSJT-X does too is not yet checked.
const SNR_OFFSET_DB = 0;

/** Waterfall value (half-dB steps from -120 dB) to linear power. */
const dbToPower = (v) => Math.pow(10, (v / 2 - 120) / 10);

/** Loads a separate instance of the ft8_lib wasm module (each worker needs its own). */
export async function loadFt8libModule() {
    const base = new URL('./ft8lib/', import.meta.url);
    return createFt8libModule({
        // ft8_lib prints its DSP settings (block size, FFT size) to stderr; keep other messages.
        printErr: (text) => {
            if (!/^(Block size|Subblock size|N_FFT|Waterfall size) =/.test(text)) console.error(text);
        },
        locateFile: (path) => {
            const url = new URL(path, base);
            return url.protocol === 'file:' ? decodeURIComponent(url.pathname) : url.href;
        },
    });
}

export class FT8Receiver {
    /**
     * @param module ft8_lib wasm module from loadFt8libModule()
     * @param {{sampleRate?: number, fMin?: number, fMax?: number, timeOsr?: number, freqOsr?: number, ft4?: boolean}} options
     */
    constructor(module, { sampleRate = 12000, fMin = 200, fMax = 3000, timeOsr = 2, freqOsr = 2, ft4 = false } = {}) {
        this.module = module;
        this.ptr = module._rxft8_create(sampleRate, fMin, fMax, timeOsr, freqOsr, ft4 ? 1 : 0);
        if (!this.ptr) throw new Error('rxft8_create failed');
        this.sampleRate = sampleRate;
        this.timeOsr = timeOsr;
        this.freqOsr = freqOsr;
        this.blockSize = module._rxft8_block_size(this.ptr);
        this.maxBlocks = module._rxft8_max_blocks(this.ptr);
        this.numBins = module._rxft8_num_bins(this.ptr);
        this.symbolPeriod = module._rxft8_symbol_period(this.ptr);
        // Frequency of waterfall bin 0, in Hz. Bins are 1 / symbolPeriod Hz apart (6.25 Hz for FT8).
        this.minFreq = module._rxft8_min_bin(this.ptr) / this.symbolPeriod;
    }

    /** Number of blocks stored since the last reset(). */
    get numBlocks() {
        return this.module._rxft8_num_blocks(this.ptr);
    }

    /**
     * Processes one block of audio.
     * @param {Float32Array} block exactly blockSize samples
     * @returns {number} blocks stored so far (stops at maxBlocks)
     */
    feed(block) {
        if (block.length !== this.blockSize) throw new Error(`feed() needs ${this.blockSize} samples, got ${block.length}`);
        const inputPtr = this.module._rxft8_input(this.ptr);
        this.module.HEAPF32.set(block, inputPtr / 4);
        return this.module._rxft8_feed(this.ptr);
    }

    /**
     * Magnitudes for one stored block: numBins values, where v means (v / 2 - 120) dB.
     * @returns {Uint8Array|null} a copy, or null if the block isn't stored
     */
    waterfallRow(block, timeSub = 0, freqSub = 0) {
        const rowPtr = this.module._rxft8_waterfall_row(this.ptr, block, timeSub, freqSub);
        if (!rowPtr) return null;
        return this.module.HEAPU8.slice(rowPtr, rowPtr + this.numBins);
    }

    /**
     * Decodes the audio fed since the last reset(). Defaults match ft8_lib's decode_ft8 demo.
     * @returns {Array<{payload: Uint8Array, bits: string, score: number, timeSec: number, freqHz: number,
     *   timeOffset: number, freqOffset: number, timeSub: number, freqSub: number, ldpcErrors: number}>}
     */
    decode({ maxCandidates = 140, minScore = 10, ldpcIterations = 25, maxResults = 50 } = {}) {
        const m = this.module;
        const outPtr = m._malloc(RESULT_SIZE * maxResults);
        try {
            const n = m._rxft8_decode(this.ptr, maxCandidates, minScore, ldpcIterations, outPtr, maxResults);
            const view = new DataView(m.HEAPU8.buffer, outPtr, RESULT_SIZE * n);
            const results = [];
            for (let i = 0; i < n; i++) {
                const o = i * RESULT_SIZE;
                const payload = m.HEAPU8.slice(outPtr + o, outPtr + o + 10);
                results.push({
                    payload,
                    bits: Array.from(payload, b => b.toString(2).padStart(8, '0')).join('').slice(0, 77),
                    score: view.getInt16(o + 10, true),
                    timeSec: view.getFloat32(o + 12, true),
                    freqHz: view.getFloat32(o + 16, true),
                    timeOffset: view.getInt16(o + 20, true),
                    freqOffset: view.getInt16(o + 22, true),
                    timeSub: view.getUint8(o + 24),
                    freqSub: view.getUint8(o + 25),
                    ldpcErrors: view.getInt16(o + 26, true),
                });
            }
            return results;
        } finally {
            m._free(outPtr);
        }
    }

    /**
     * WSJT-X style time offset: seconds from 0.5 s after the start of the audio fed in.
     * ft8_lib's timeSec is one symbol later than the signal start (checked against WSJT-X
     * decodes of ft8_lib's test recordings: median difference 0.66 s = 0.5 s + 0.16 s).
     */
    dt(result) {
        return result.timeSec - this.symbolPeriod - 0.5;
    }

    /** The 79 tones (0 to 7) for a decoded payload, from ft8_lib's encoder. */
    tones(payload) {
        const m = this.module;
        const ptr = m.ccall('packedToSymbols', 'number', ['array'], [payload]);
        const tones = m.HEAPU8.slice(ptr, ptr + 79);
        m._free(ptr);
        return tones;
    }

    /**
     * Approximate signal-to-noise ratio in dB in a 2500 Hz bandwidth.
     * Signal: average power in the bins of the 79 transmitted tones. Noise: the 10th percentile
     * of the slot's average spectrum within 200 Hz of the signal (a local baseline, as WSJT-X
     * uses), scaled to 2500 Hz. See SNR_OFFSET_DB for how it compares with WSJT-X.
     */
    snr(result) {
        const tones = this.tones(result.payload);
        const avg = this.averageSpectrum();
        let signal = 0, count = 0;
        for (let k = 0; k < 79; k++) {
            const row = this.waterfallRow(result.timeOffset + k, result.timeSub, result.freqSub);
            if (row == null) continue;
            const bin = result.freqOffset + tones[k];
            if (bin < 0 || bin >= row.length) continue;
            signal += dbToPower(row[bin]);
            count++;
        }
        if (count === 0) return null;
        const near = [];
        const lo = Math.max(0, result.freqOffset - SNR_BASELINE_BINS);
        const hi = Math.min(this.numBins, result.freqOffset + 8 + SNR_BASELINE_BINS);
        for (const spectrum of avg) for (let b = lo; b < hi; b++) near.push(spectrum[b]);
        near.sort((a, b) => a - b);
        const noisePerBin = near[Math.floor(0.1 * (near.length - 1))];
        const ratio = Math.max(signal / count / noisePerBin - 1, 0.001);
        return 10 * Math.log10(ratio) - 10 * Math.log10(2500 * this.symbolPeriod) - SNR_OFFSET_DB;
    }

    /** Average power per bin over the stored blocks, one array per frequency subdivision (cached). */
    averageSpectrum() {
        const blocks = this.numBlocks;
        if (this._avg && this._avgBlocks === blocks) return this._avg;
        const avg = Array.from({ length: this.freqOsr }, () => new Float64Array(this.numBins));
        for (let blk = 0; blk < blocks; blk++) {
            for (let ts = 0; ts < this.timeOsr; ts++) {
                for (let fs = 0; fs < this.freqOsr; fs++) {
                    const row = this.waterfallRow(blk, ts, fs);
                    for (let b = 0; b < this.numBins; b++) avg[fs][b] += dbToPower(row[b]);
                }
            }
        }
        const n = Math.max(1, blocks * this.timeOsr);
        for (const spectrum of avg) for (let b = 0; b < this.numBins; b++) spectrum[b] /= n;
        this._avg = avg;
        this._avgBlocks = blocks;
        return avg;
    }

    /** Clears the stored waterfall, ready for the next slot. */
    reset() {
        this._avg = null;
        this.module._rxft8_reset(this.ptr);
    }

    free() {
        if (this.ptr) this.module._rxft8_free(this.ptr);
        this.ptr = 0;
    }
}
