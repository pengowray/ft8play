// Decoder worker: owns an ft8_lib FT8 receiver, so decoding never blocks the page.
//
// Messages from the page:
//   { type: 'init', sampleRate }
//   { type: 'feed', slot, samples: Float32Array }   any length; split into blocks here
//   { type: 'decode', slot }                        decode what was fed, then clear for the next slot
//   { type: 'reset' }                               drop what was fed without decoding
// Messages to the page:
//   { type: 'ready', blockSize, numBins, minFreq, binHz, freqOsr, maxBlocks }
//   { type: 'row', slot, block, row: Uint8Array }   one waterfall row per block, numBins * freqOsr values,
//                                                   bins interleaved by frequency (value v = v / 2 - 120 dB)
//   { type: 'decodes', slot, blocks, results: [{ bits, freqHz, dt, snr, score }] }
//   { type: 'error', message }

import { loadFt8libModule, FT8Receiver } from '../ft8_rx.js';

let rx = null;
let block = null;     // partial block being filled
let blockFill = 0;
let currentSlot = null;

function handle(m) {
    switch (m.type) {
        case 'feed': {
            if (m.slot !== currentSlot) {
                // Audio for a new slot without a decode request: start again.
                rx.reset();
                blockFill = 0;
                currentSlot = m.slot;
            }
            let pos = 0;
            const samples = m.samples;
            while (pos < samples.length) {
                const n = Math.min(rx.blockSize - blockFill, samples.length - pos);
                block.set(samples.subarray(pos, pos + n), blockFill);
                blockFill += n;
                pos += n;
                if (blockFill === rx.blockSize) {
                    const before = rx.numBlocks;
                    const after = rx.feed(block);
                    blockFill = 0;
                    if (after > before) postRow(m.slot, after - 1);
                }
            }
            break;
        }
        case 'decode': {
            const results = m.slot === currentSlot ? rx.decode().map(d => ({
                bits: d.bits,
                freqHz: d.freqHz,
                dt: rx.dt(d),
                snr: rx.snr(d),
                score: d.score,
            })) : [];
            postMessage({ type: 'decodes', slot: m.slot, blocks: rx.numBlocks, results });
            rx.reset();
            blockFill = 0;
            currentSlot = null;
            break;
        }
        case 'reset':
            rx.reset();
            blockFill = 0;
            currentSlot = null;
            break;
    }
}

function postRow(slot, blockIndex) {
    const row = new Uint8Array(rx.numBins * rx.freqOsr);
    for (let fs = 0; fs < rx.freqOsr; fs++) {
        const r = rx.waterfallRow(blockIndex, 0, fs);
        for (let b = 0; b < rx.numBins; b++) row[b * rx.freqOsr + fs] = r[b];
    }
    postMessage({ type: 'row', slot, block: blockIndex, row }, [row.buffer]);
}

// Handle messages in order, even while the wasm module is still loading.
let queue = Promise.resolve();
self.onmessage = (e) => {
    const m = e.data;
    queue = queue.then(async () => {
        try {
            if (m.type === 'init') {
                const module = await loadFt8libModule();
                rx = new FT8Receiver(module, { sampleRate: m.sampleRate });
                block = new Float32Array(rx.blockSize);
                postMessage({
                    type: 'ready', blockSize: rx.blockSize, numBins: rx.numBins, minFreq: rx.minFreq,
                    binHz: 1 / rx.symbolPeriod, freqOsr: rx.freqOsr, maxBlocks: rx.maxBlocks,
                });
            } else if (rx) {
                handle(m);
            }
        } catch (err) {
            postMessage({ type: 'error', message: err.message });
        }
    });
};
