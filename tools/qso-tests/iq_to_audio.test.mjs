// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IqToUsbAudio } from '../../docs/qso/dsp/iq_to_audio.js';
import { bitsToTones, genFt8Wave } from '../../docs/qso/ft8_wave.js';
import { PackJT77, fmtmsg, genft8Message } from '../../docs/wsjtx/packjt77.js';
import { loadFt8libModule, FT8Receiver } from '../../docs/ft8_rx.js';

function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) + 0.5) / 4294967296;
}

/** 15 s of IQ at `rate`, SDR tuned `offset` Hz above the dial, with FT8 signals at audio offsets. */
function makeIq(rate, offset, signals, { sigma = 0.02, seed = 7 } = {}) {
    const n = 15 * rate;
    const re = new Float64Array(n), im = new Float64Array(n);
    const rnd = rng(seed);
    for (let i = 0; i < n; i++) {
        const r = Math.sqrt(-2 * Math.log(rnd())), a = 2 * Math.PI * rnd();
        re[i] = sigma * r * Math.cos(a);
        im[i] = sigma * r * Math.sin(a);
    }
    const packer = new PackJT77();
    for (const s of signals) {
        const c77 = genft8Message(packer, fmtmsg(s.text.padEnd(37))).c77;
        const w = genFt8Wave(bitsToTones(c77), { sampleRate: rate, f0: s.audioHz - offset, amplitude: s.amplitude, complex: true });
        const start = Math.round((0.5 + s.dt) * rate);
        for (let k = 0; k < w.re.length; k++) {
            const j = start + k;
            if (j >= 0 && j < n) { re[j] += w.re[k]; im[j] += w.im[k]; }
        }
    }
    return { re, im };
}

function toU8(re, im) {
    const out = new Uint8Array(re.length * 2);
    for (let i = 0; i < re.length; i++) {
        out[2 * i] = Math.max(0, Math.min(255, Math.round(re[i] * 127.5 + 127.5)));
        out[2 * i + 1] = Math.max(0, Math.min(255, Math.round(im[i] * 127.5 + 127.5)));
    }
    return out;
}

test('IQ through IqToUsbAudio decodes the upper sideband only', async () => {
    const rate = 240000, offset = 20000;
    const signals = [
        { text: 'CQ K1ABC FN42', audioHz: 700, dt: 0.0, amplitude: 0.004 },
        { text: 'K1ABC W9XYZ -11', audioHz: 1500, dt: 0.4, amplitude: 0.002 },
        { text: 'W9XYZ K1ABC RR73', audioHz: 2400, dt: -0.2, amplitude: 0.01 },
        // Lower sideband: 1500 Hz below the dial. A USB receiver must not hear it.
        { text: 'CQ G4ABC IO91', audioHz: -1500, dt: 0.1, amplitude: 0.05 },
    ];
    const { re, im } = makeIq(rate, offset, signals);
    const iq = toU8(re, im);

    const conv = new IqToUsbAudio({ inputRate: rate, offsetHz: offset });
    const chunks = [];
    const block = 24576 * 2; // bytes per read, as the RTL-SDR source reads them
    for (let pos = 0; pos < iq.length; pos += block) chunks.push(conv.processU8(iq.subarray(pos, pos + block)));
    const audio = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let k = 0;
    for (const c of chunks) { audio.set(c, k); k += c.length; }
    assert.ok(Math.abs(audio.length - 15 * 12000) <= 2, `audio length ${audio.length}`);

    const module = await loadFt8libModule();
    const rx = new FT8Receiver(module, { sampleRate: 12000 });
    for (let pos = 0; pos + rx.blockSize <= audio.length; pos += rx.blockSize) rx.feed(audio.subarray(pos, pos + rx.blockSize));
    const packer = new PackJT77();
    const decodes = rx.decode().map(d => ({ text: packer.unpack77(d.bits, 1).msg.trim(), freq: d.freqHz, dt: rx.dt(d) }));
    rx.free();

    // The filters delay the audio slightly; allow for it in DT.
    const delay = (331 / 2) / 12000 + (45 / 2) / 48000 + (43 / 2) / 240000;
    for (const s of signals.filter(s => s.audioHz > 0)) {
        const d = decodes.find(x => x.text === s.text);
        assert.ok(d, `decoded ${s.text} (got ${decodes.map(x => x.text).join(', ')})`);
        assert.ok(Math.abs(d.freq - s.audioHz) < 3.2, `${s.text}: ${d.freq} Hz vs ${s.audioHz}`);
        assert.ok(Math.abs(d.dt - delay - s.dt) < 0.09, `${s.text}: DT ${d.dt.toFixed(3)} vs ${s.dt} + ${delay.toFixed(3)}`);
    }
    assert.ok(!decodes.some(d => d.text === 'CQ G4ABC IO91'), 'lower sideband signal must not be decoded');
    assert.equal(decodes.length, 3, `unexpected decodes: ${decodes.map(x => x.text).join(', ')}`);
});
