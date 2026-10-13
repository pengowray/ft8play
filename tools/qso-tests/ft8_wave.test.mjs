// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bitsToTones, genFt8Wave } from '../../docs/qso/ft8_wave.js';
import { testInputs_ft8code } from '../../docs/ft8_tests.js';
import { PackJT77, fmtmsg, genft8Message } from '../../docs/wsjtx/packjt77.js';
import { loadFt8libModule, FT8Receiver } from '../../docs/ft8_rx.js';
import { symbolsToBitsStrNoCosta } from '../../docs/ft8_convert.js';

test('bitsToTones matches the tones WSJT-X ft8code printed for every fixture', () => {
    for (const f of testInputs_ft8code) {
        const symbols = f.symbols.replace(/\s/g, '');
        const bits77 = symbolsToBitsStrNoCosta(symbols).slice(0, 77);
        assert.equal(Array.from(bitsToTones(bits77)).join(''), symbols, f.message);
    }
});

// Seeded noise, so the test is repeatable.
function gaussianNoise(n, sigma, seed = 1) {
    let s = seed >>> 0;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) + 0.5) / 4294967296;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
        const r = Math.sqrt(-2 * Math.log(rnd())), a = 2 * Math.PI * rnd();
        out[i] = sigma * r * Math.cos(a);
        if (i + 1 < n) out[i + 1] = sigma * r * Math.sin(a);
    }
    return out;
}

test('genFt8Wave audio decodes with the right text, frequency, DT and SNR', async () => {
    const module = await loadFt8libModule();
    const sampleRate = 12000;
    const messages = [
        { text: 'CQ K1ABC FN42', f0: 600, dt: 0.0, snrDb: -10 },
        { text: 'K1ABC W9XYZ -11', f0: 1300, dt: 0.5, snrDb: -15 },
        { text: 'W9XYZ K1ABC RR73', f0: 2100, dt: -0.3, snrDb: 0 },
    ];
    // White noise with power sigma^2 per sample spreads over 6000 Hz; SNR is in 2500 Hz.
    const sigma = 0.02;
    const noisePower2500 = sigma * sigma * 2500 / (sampleRate / 2);
    const slot = gaussianNoise(15 * sampleRate, sigma);
    const packer = new PackJT77();
    for (const m of messages) {
        const r = genft8Message(packer, fmtmsg(m.text.padEnd(37)));
        // A sine of amplitude A has power A^2 / 2.
        const amplitude = Math.sqrt(2 * noisePower2500 * Math.pow(10, m.snrDb / 10));
        const wave = genFt8Wave(bitsToTones(r.c77), { sampleRate, f0: m.f0, amplitude });
        const start = Math.round((0.5 + m.dt) * sampleRate);
        for (let i = 0; i < wave.length && start + i < slot.length; i++) if (start + i >= 0) slot[start + i] += wave[i];
    }

    const rx = new FT8Receiver(module, { sampleRate });
    for (let pos = 0; pos + rx.blockSize <= slot.length; pos += rx.blockSize) rx.feed(slot.subarray(pos, pos + rx.blockSize));
    const decodes = rx.decode().map(d => ({ text: new PackJT77().unpack77(d.bits, 1).msg.trim(), freq: d.freqHz, dt: rx.dt(d), snr: rx.snr(d) }));
    rx.free();

    for (const m of messages) {
        const d = decodes.find(x => x.text === m.text);
        assert.ok(d, `decoded ${m.text} (got ${decodes.map(x => x.text).join(', ')})`);
        assert.ok(Math.abs(d.freq - m.f0) < 3.2, `${m.text} frequency ${d.freq} vs ${m.f0}`);
        assert.ok(Math.abs(d.dt - m.dt) < 0.09, `${m.text} DT ${d.dt} vs ${m.dt}`);
        assert.ok(Math.abs(d.snr - m.snrDb) < 2.5, `${m.text} SNR ${d.snr.toFixed(1)} vs ${m.snrDb}`);
    }
});
