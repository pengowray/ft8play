// Receive pipeline: takes 12 kHz audio with timestamps from any source, splits it into
// slots, streams it to the decoder worker, and turns the worker's results into decodes
// with text (unpacked by the WSJT-X port, with one long-lived hash table, as WSJT-X does).
//
// Events (CustomEvent, data in .detail):
//   'ready'   { numBins, minFreq, binHz }       waterfall geometry; bins are binHz apart
//   'row'     { slot, block, row, minFreq, binHz }  one waterfall row (every symbol period)
//   'slot'    { slot, start }                   a new slot started receiving
//   'decodes' { slot, start, label, receivedSeconds, decodes: [{ text, success, freqHz, dt, snr, bits }] }
//             receivedSeconds: seconds of audio actually received for the slot (less if receiving
//             started or stopped part-way through)
//   'error'   { message }

import { PackJT77 } from '../wsjtx/packjt77.js';

export class RxPipeline extends EventTarget {
    /**
     * @param {{clock: import('./slot_clock.js').SlotClock}} options
     */
    constructor({ clock }) {
        super();
        this.clock = clock;
        this.mode = clock.mode;
        this.sampleRate = this.mode.sampleRate;
        this.packer = new PackJT77();
        this.worker = null;
        this.geometry = null;
        this.slot = null;          // slot currently being received
        this.slotFed = 0;          // samples fed for that slot, including silence padding
        this.slotPadded = 0;       // silence added where no audio was received
        this.decodeRequested = false;
        this.receivedSeconds = new Map(); // slot -> seconds of real audio received
        this.pendingLabels = new Map(); // slot -> label shown with its decodes
    }

    async start() {
        if (this.worker) return this.geometry;
        this.worker = new Worker(new URL('./decoder_worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this.onWorkerMessage(e.data);
        this.worker.onerror = (e) => this.emit('error', { message: e.message || 'Decoder failed to start' });
        const ready = new Promise((resolve) => { this.resolveReady = resolve; });
        this.worker.postMessage({ type: 'init', sampleRate: this.sampleRate });
        return ready;
    }

    /** My callsign, for hash lookups (WSJT-X shows <MYCALL> for my hashed call). */
    setMyCall(call) {
        this.packer.mycall13 = (call || '').trim().toUpperCase();
    }

    setDxCall(call) {
        this.packer.dxcall13 = (call || '').trim().toUpperCase();
    }

    /**
     * Live audio from a source.
     * @param {Float32Array} samples 12 kHz samples
     * @param {number} startTime corrected clock time (ms) of the first sample
     */
    pushAudio(samples, startTime) {
        const msPerSample = 1000 / this.sampleRate;
        let pos = 0;
        while (pos < samples.length) {
            const t = startTime + pos * msPerSample;
            const slot = this.clock.slotIndex(t);
            if (slot !== this.slot) this.beginSlot(slot);

            // Pad with silence if this audio starts later in the slot than what was fed so far.
            const offset = Math.round((t - this.clock.slotStart(slot)) / msPerSample);
            if (offset > this.slotFed) {
                this.slotPadded += offset - this.slotFed;
                this.feed(new Float32Array(offset - this.slotFed));
            }

            const slotEnd = this.clock.slotStart(slot + 1);
            const untilSlotEnd = Math.max(1, Math.ceil((slotEnd - t) / msPerSample));
            const n = Math.min(samples.length - pos, untilSlotEnd);
            this.feed(samples.subarray(pos, pos + n));
            pos += n;

            if (!this.decodeRequested && this.slotFed >= this.mode.decodeAtSeconds * this.sampleRate) {
                this.requestDecode();
            }
        }
    }

    /** Stop a live source: decode what was received of the current slot. */
    flush() {
        if (this.slot != null && !this.decodeRequested && this.slotFed > 0) this.requestDecode();
        this.slot = null;
    }

    /**
     * Decodes a recording as one slot (e.g. a WAV file saved by WSJT-X, which starts at a slot boundary).
     * @param {Float32Array} samples 12 kHz samples, at most one slot long is used
     * @param {string} label shown with the decodes instead of a time
     */
    decodeRecording(samples, label) {
        this.flush();
        const slot = `file:${label}:${Date.now()}`;
        this.slot = slot;
        this.slotFed = 0;
        this.slotPadded = 0;
        this.decodeRequested = false;
        this.emit('slot', { slot, start: null, label });
        this.feed(samples.subarray(0, Math.min(samples.length, this.mode.slotSeconds * this.sampleRate)));
        this.pendingLabels.set(slot, label);
        this.requestDecode();
        this.slot = null;
    }

    beginSlot(slot) {
        if (this.slot != null && !this.decodeRequested && this.slotFed > 0) this.requestDecode();
        this.slot = slot;
        this.slotFed = 0;
        this.slotPadded = 0;
        this.decodeRequested = false;
        this.emit('slot', { slot, start: this.clock.slotStart(slot) });
    }

    feed(samples) {
        if (samples.length === 0) return;
        const copy = new Float32Array(samples); // transferable, so the source can reuse its buffer
        this.worker.postMessage({ type: 'feed', slot: this.slot, samples: copy }, [copy.buffer]);
        this.slotFed += samples.length;
    }

    requestDecode() {
        this.decodeRequested = true;
        this.receivedSeconds.set(this.slot, (this.slotFed - this.slotPadded) / this.sampleRate);
        this.worker.postMessage({ type: 'decode', slot: this.slot });
    }

    onWorkerMessage(m) {
        switch (m.type) {
            case 'ready':
                this.geometry = { numBins: m.numBins * m.freqOsr, minFreq: m.minFreq, binHz: m.binHz / m.freqOsr, blockSize: m.blockSize };
                this.emit('ready', this.geometry);
                this.resolveReady?.(this.geometry);
                break;
            case 'row':
                this.emit('row', { slot: m.slot, block: m.block, row: m.row, minFreq: this.geometry.minFreq, binHz: this.geometry.binHz });
                break;
            case 'decodes': {
                const isFile = typeof m.slot === 'string';
                const decodes = m.results.map((r) => {
                    let text = '', success = false;
                    try {
                        const u = this.packer.unpack77(r.bits, 1);
                        text = u.msg.trim();
                        success = u.success;
                    } catch (err) {
                        text = '';
                    }
                    return { ...r, text, success };
                }).filter(d => d.success).sort((a, b) => a.freqHz - b.freqHz);
                const label = this.pendingLabels.get(m.slot) ?? null;
                this.pendingLabels.delete(m.slot);
                const receivedSeconds = this.receivedSeconds.get(m.slot) ?? null;
                this.receivedSeconds.delete(m.slot);
                this.emit('decodes', { slot: m.slot, start: isFile ? null : this.clock.slotStart(m.slot), label, receivedSeconds, decodes });
                break;
            }
            case 'error':
                this.emit('error', { message: m.message });
                break;
        }
    }

    emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }
}
