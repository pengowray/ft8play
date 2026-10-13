#!/usr/bin/env node
// Checks docs/ft8_rx.js (ft8_lib's decoder in wasm) against ft8_lib's native decode_ft8,
// and reports how its decodes compare with the expected WSJT-X decodes in ft8_lib's test files.
//
//   node check.mjs <decode_ref binary> <wav or folder>...
//
// decode_ref is demo/decode_ft8.c built natively with one extra printf per decode:
//   "<score> <time_sec> <freq_hz> <time_offset> <freq_offset> <time_sub*10+freq_sub> <payload hex> <text>"
// (see README.md). Exit code 0 when the wasm results match the native ones on every file.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadFt8libModule, FT8Receiver } from '../../docs/ft8_rx.js';
import { PackJT77 } from '../../docs/wsjtx/packjt77.js';

const [refBin, ...paths] = process.argv.slice(2);
if (!refBin || paths.length === 0) {
    console.error('usage: node check.mjs <decode_ref> <wav or folder>...');
    process.exit(2);
}

const wavs = paths.flatMap(p => statSync(p).isDirectory()
    ? readdirSync(p, { recursive: true }).filter(f => f.endsWith('.wav')).map(f => join(p, f))
    : [p]).sort();

/** 16-bit mono PCM WAV, as ft8_lib's load_wav reads it (at most 15 s at 12 kHz). */
function loadWav(path) {
    const buf = readFileSync(path);
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
    let pos = 12, sampleRate = 0, data = null;
    while (pos + 8 <= buf.length) {
        const id = buf.toString('ascii', pos, pos + 4);
        const size = buf.readUInt32LE(pos + 4);
        if (id === 'fmt ') {
            const format = buf.readUInt16LE(pos + 8), channels = buf.readUInt16LE(pos + 10), bits = buf.readUInt16LE(pos + 22);
            if (format !== 1 || channels !== 1 || bits !== 16) throw new Error('needs 16-bit mono PCM');
            sampleRate = buf.readUInt32LE(pos + 12);
        } else if (id === 'data') {
            data = buf.subarray(pos + 8, pos + 8 + size);
        }
        pos += 8 + size + (size & 1);
    }
    const n = data.length / 2;
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) samples[i] = data.readInt16LE(i * 2) / 32768;
    return { sampleRate, samples };
}

function decodeWasm(module, { sampleRate, samples }) {
    const rx = new FT8Receiver(module, { sampleRate });
    try {
        for (let pos = 0; pos + rx.blockSize <= samples.length; pos += rx.blockSize) {
            rx.feed(samples.subarray(pos, pos + rx.blockSize));
        }
        return rx.decode().map(d => ({ ...d, snr: rx.snr(d), dt: rx.dt(d) }));
    } finally {
        rx.free();
    }
}

function decodeNative(path) {
    const r = spawnSync(refBin, [path], { encoding: 'utf8' });
    return r.stdout.trim().split('\n').filter(Boolean).map(line => {
        const [score, time, freq, , , , hex] = line.split(' ');
        return { score: +score, time: +time, freq: +freq, hex, text: line.split(' ').slice(7).join(' ') };
    });
}

// Expected decodes: lines like "000000  -4  1.3  335 ~  AE0XI R7CA -15"
function loadExpected(wavPath) {
    const txt = wavPath.replace(/\.wav$/, '.txt');
    if (!existsSync(txt)) return null;
    return readFileSync(txt, 'utf8').split('\n').map(l => l.match(/^\S+\s+(-?\d+)\s+(-?[\d.]+)\s+(\d+)\s+~\s+(.*?)\s*$/)).filter(Boolean)
        .map(m => ({ snr: +m[1], dt: +m[2], freq: +m[3], text: m[4].replace(/\s{2,}.*$/, '').trim() }));
}

const module = await loadFt8libModule();
let mismatchedFiles = 0, totalWasm = 0, totalExpected = 0, totalFound = 0;
const dtPairs = [], snrPairs = [];
for (const path of wavs) {
    const audio = loadWav(path);
    const wasm = decodeWasm(module, audio);
    const native = decodeNative(path);
    totalWasm += wasm.length;

    const key = (d) => `${d.hex} ${d.score} ${d.time.toFixed(3)} ${d.freq.toFixed(3)}`;
    const a = native.map(key);
    const b = wasm.map(d => key({ hex: Array.from(d.payload, x => x.toString(16).padStart(2, '0')).join(''), score: d.score, time: d.timeSec, freq: d.freqHz }));
    const same = a.length === b.length && a.every((k, i) => k === b[i]);
    if (!same) {
        mismatchedFiles++;
        console.log(`MISMATCH ${path}: native ${a.length}, wasm ${b.length}`);
        for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) console.log(`  #${i} native: ${a[i]}\n      wasm:   ${b[i]}`);
    }

    // Compare with the expected decodes (text unpacked by the WSJT-X port, fresh hash tables per file).
    const expected = loadExpected(path);
    if (expected) {
        const st = new PackJT77();
        const texts = wasm.map(d => ({ d, text: st.unpack77(d.bits, 1).msg.trim() }));
        totalExpected += expected.length;
        for (const e of expected) {
            const hit = texts.find(t => t.text === e.text && Math.abs(t.d.freqHz - e.freq) < 10);
            if (hit) {
                totalFound++;
                dtPairs.push(hit.d.dt - e.dt);
                if (hit.d.snr != null) snrPairs.push([hit.d.snr, e.snr]);
            }
        }
    }
}

console.log(`${wavs.length} files, ${totalWasm} wasm decodes; files where wasm != native: ${mismatchedFiles}`);
if (totalExpected) {
    const sorted = [...dtPairs].sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(`expected decodes found: ${totalFound} of ${totalExpected} (${(100 * totalFound / totalExpected).toFixed(1)}%)`);
    console.log(`DT minus expected DT: median ${median?.toFixed(3)} s, middle half ${sorted[Math.floor(sorted.length / 4)]?.toFixed(3)} to ${sorted[Math.floor(3 * sorted.length / 4)]?.toFixed(3)} s`);
    const diffs = snrPairs.map(([a, b]) => a - b).sort((x, y) => x - y);
    const q = (f) => diffs[Math.floor(f * (diffs.length - 1))].toFixed(1);
    console.log(`SNR minus expected SNR (dB): median ${q(0.5)}, middle half ${q(0.25)} to ${q(0.75)}, 90% within ${q(0.05)} to ${q(0.95)}`);
    // by expected SNR band
    for (const [lo, hi] of [[-30, -18], [-18, -10], [-10, 0], [0, 30]]) {
        const d = snrPairs.filter(([, b]) => b >= lo && b < hi).map(([a, b]) => a - b).sort((x, y) => x - y);
        if (d.length) console.log(`  expected ${lo} to ${hi} dB: n=${d.length}, median diff ${d[Math.floor(d.length / 2)].toFixed(1)}`);
    }
}
process.exit(mismatchedFiles === 0 ? 0 : 1);
