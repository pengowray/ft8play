// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Resampler } from '../../docs/qso/dsp/resample.js';
import { bitsToTones, genFt8Wave } from '../../docs/qso/ft8_wave.js';
import { PackJT77, fmtmsg, genft8Message } from '../../docs/wsjtx/packjt77.js';
import { loadFt8libModule, FT8Receiver } from '../../docs/ft8_rx.js';

function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) + 0.5) / 4294967296;
}

function gaussianNoise(n, sigma, seed = 1) {
    const rnd = rng(seed);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 2) {
        const r = Math.sqrt(-2 * Math.log(rnd())), a = 2 * Math.PI * rnd();
        out[i] = sigma * r * Math.cos(a);
        if (i + 1 < n) out[i + 1] = sigma * r * Math.sin(a);
    }
    return out;
}

function concat(parts) {
    const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
    let k = 0;
    for (const p of parts) { out.set(p, k); k += p.length; }
    return out;
}

/**
 * Resamples `input` in chunks. chunkSize is a number, or a function giving each chunk's size.
 * @returns {{out: Float32Array, calls: {inputsBefore: number, outputsBefore: number, offset: number}[], rs: Resampler}}
 */
function resample(inRate, outRate, input, chunkSize) {
    const rs = new Resampler(inRate, outRate);
    const parts = [], calls = [];
    let outputs = 0;
    for (let pos = 0; pos < input.length;) {
        const n = typeof chunkSize === 'function' ? chunkSize() : chunkSize;
        const out = rs.process(input.subarray(pos, pos + n));
        calls.push({ inputsBefore: pos, outputsBefore: outputs, offset: rs.outputOffset });
        parts.push(out);
        outputs += out.length;
        pos += n;
    }
    return { out: concat(parts), calls, rs };
}

function sine(rate, freqHz, seconds, phase = 0) {
    const out = new Float32Array(Math.round(rate * seconds));
    for (let i = 0; i < out.length; i++) out[i] = Math.sin(2 * Math.PI * freqHz * i / rate + phase);
    return out;
}

function rms(x) {
    let s = 0;
    for (const v of x) s += v * v;
    return Math.sqrt(s / x.length);
}

const ft8Tones = bitsToTones(genft8Message(new PackJT77(), fmtmsg('CQ K1ABC FN42'.padEnd(37))).c77);

test('FT8 audio resampled to 12 kHz matches FT8 audio made at 12 kHz', () => {
    const ref = genFt8Wave(ft8Tones, { sampleRate: 12000, f0: 1500, amplitude: 0.5 });
    for (const rate of [44100, 48000, 96000, 16000]) {
        const wave = genFt8Wave(ft8Tones, { sampleRate: rate, f0: 1500, amplitude: 0.5 });
        // Silence after the signal, so the resampler gives out all of it.
        const input = new Float32Array(wave.length + rate / 10);
        input.set(wave);
        const { out } = resample(rate, 12000, input, Math.round(rate / 10));
        assert.ok(out.length >= ref.length, `${rate}: ${out.length} samples out`);
        // No time shift to correct for: output sample m is at the time of 12 kHz sample m.
        let sxy = 0, sxx = 0, syy = 0, see = 0;
        for (let m = 0; m < ref.length; m++) {
            sxy += out[m] * ref[m];
            sxx += out[m] * out[m];
            syy += ref[m] * ref[m];
            see += (out[m] - ref[m]) ** 2;
        }
        const corr = sxy / Math.sqrt(sxx * syy);
        const relErr = Math.sqrt(see / syy);
        assert.ok(corr > 0.9999, `${rate}: correlation ${corr}`);
        assert.ok(relErr < 0.01, `${rate}: RMS error ${(100 * relErr).toFixed(2)}% of the signal`);
    }
});

test('tones from 6.2 kHz up are at least 60 dB down after resampling to 12 kHz', () => {
    // Above 6 kHz they would alias into the 12 kHz audio, and 6 to 9 kHz would land in the FT8 band.
    for (const rate of [44100, 48000, 96000]) {
        for (const freq of [6200, 7000, 9000, 15000, 20000]) {
            const { out } = resample(rate, 12000, sine(rate, freq, 1, 0.3), 4410);
            const steady = out.subarray(200); // after the start-up transient
            const db = 20 * Math.log10(rms(steady) / Math.SQRT1_2);
            assert.ok(db < -60, `${rate} Hz input, ${freq} Hz tone: ${db.toFixed(1)} dB`);
        }
    }
});

test('tones in the FT8 band keep their amplitude (within 0.1 dB) and timing', () => {
    for (const rate of [8000, 12000, 16000, 22050, 44100, 48000, 96000]) {
        // 8 kHz input has a lower passband (to 2.67 kHz), so only 1 kHz is checked there.
        for (const freq of rate < 12000 ? [1000] : [200, 1000, 3000]) {
            const { out } = resample(rate, 12000, sine(rate, freq, 1), 4410);
            const from = 200, to = out.length;
            const steady = out.subarray(from, to);
            const db = 20 * Math.log10(rms(steady) / Math.SQRT1_2);
            assert.ok(Math.abs(db) < 0.1, `${rate} Hz input, ${freq} Hz tone: ${db.toFixed(3)} dB`);
            // Compare with the same sine made at 12 kHz: checks the phase too.
            const ideal = sine(12000, freq, to / 12000).subarray(from, to);
            const err = steady.map((v, i) => v - ideal[i]);
            const errDb = 20 * Math.log10(rms(err) / Math.SQRT1_2);
            assert.ok(errDb < -60, `${rate} Hz input, ${freq} Hz tone: error ${errDb.toFixed(1)} dB`);
        }
    }
});

test('output does not depend on how the input is split into chunks', () => {
    for (const rate of [44100, 48000, 22050, 8000]) {
        const input = gaussianNoise(3 * rate, 0.1, rate);
        const whole = resample(rate, 12000, input, input.length).out;
        const rnd = rng(rate);
        let first = true;
        // A first chunk shorter than half the filter, then random sizes including 0 and 1.
        const pieces = resample(rate, 12000, input, () => {
            if (first) { first = false; return 5; }
            const r = rnd();
            return r < 0.1 ? 0 : r < 0.2 ? 1 : Math.floor(rnd() * 3000);
        }).out;
        assert.equal(pieces.length, whole.length, `${rate}: output length`);
        let maxDiff = 0;
        for (let i = 0; i < whole.length; i++) maxDiff = Math.max(maxDiff, Math.abs(pieces[i] - whole[i]));
        assert.ok(maxDiff < 1e-6, `${rate}: largest difference ${maxDiff}`);
    }
});

test('outputOffset gives the time of each call\'s first output sample', () => {
    for (const rate of [44100, 48000, 96000, 16000, 8000]) {
        const rnd = rng(rate + 1);
        const { calls, rs } = resample(rate, 12000, new Float32Array(10 * rate), () => Math.floor(rnd() * 6000));
        for (const c of calls) {
            // Time of the first output sample, counted from the first input sample, two ways.
            const fromInput = c.inputsBefore / rate + c.offset;
            const fromOutput = c.outputsBefore / 12000;
            assert.ok(Math.abs(fromInput - fromOutput) < 1e-9, `${rate}: ${fromInput} vs ${fromOutput}`);
            assert.ok(c.offset <= 0 && c.offset >= -rs.latency - 1e-12, `${rate}: offset ${c.offset}, latency ${rs.latency}`);
        }
    }
});

test('output length follows the rate ratio over a long run', () => {
    // 44056 Hz: an odd rate some devices report.
    for (const rate of [44100, 48000, 96000, 22050, 44056]) {
        const seconds = 60;
        const rs = new Resampler(rate, 12000);
        const chunk = new Float32Array(Math.round(rate / 10));
        let inputs = 0, outputs = 0;
        while (inputs < seconds * rate) {
            outputs += rs.process(chunk).length;
            inputs += chunk.length;
        }
        const expected = (inputs / rate - rs.latency) * 12000;
        assert.ok(Math.abs(outputs - expected) <= 1, `${rate}: ${outputs} samples out, expected ${expected.toFixed(1)}`);
    }
});

test('FT8 resampled from 44.1 kHz decodes with the right text, frequency, DT and SNR', async () => {
    const rate = 44100;
    const messages = [
        { text: 'CQ K1ABC FN42', f0: 600, dt: 0.0, snrDb: -10 },
        { text: 'K1ABC W9XYZ -11', f0: 1300, dt: 0.5, snrDb: -15 },
        { text: 'W9XYZ K1ABC RR73', f0: 2100, dt: -0.3, snrDb: 0 },
    ];
    // White noise with power sigma^2 per sample spreads over rate / 2 Hz; SNR is in 2500 Hz.
    const sigma = 0.02;
    const noisePower2500 = sigma * sigma * 2500 / (rate / 2);
    const slot = gaussianNoise(15 * rate + rate / 10, sigma);
    const packer = new PackJT77();
    for (const m of messages) {
        const amplitude = Math.sqrt(2 * noisePower2500 * Math.pow(10, m.snrDb / 10));
        const wave = genFt8Wave(bitsToTones(genft8Message(packer, fmtmsg(m.text.padEnd(37))).c77), { sampleRate: rate, f0: m.f0, amplitude });
        const start = Math.round((0.5 + m.dt) * rate);
        for (let i = 0; i < wave.length && start + i < slot.length; i++) if (start + i >= 0) slot[start + i] += wave[i];
    }
    const { out } = resample(rate, 12000, slot, 4410);
    assert.ok(out.length >= 15 * 12000, `${out.length} samples out`);

    const module = await loadFt8libModule();
    const rx = new FT8Receiver(module, { sampleRate: 12000 });
    for (let pos = 0; pos + rx.blockSize <= 15 * 12000; pos += rx.blockSize) rx.feed(out.subarray(pos, pos + rx.blockSize));
    const decodes = rx.decode().map(d => ({ text: packer.unpack77(d.bits, 1).msg.trim(), freq: d.freqHz, dt: rx.dt(d), snr: rx.snr(d) }));
    rx.free();

    for (const m of messages) {
        const d = decodes.find(x => x.text === m.text);
        assert.ok(d, `decoded ${m.text} (got ${decodes.map(x => x.text).join(', ')})`);
        assert.ok(Math.abs(d.freq - m.f0) < 3.2, `${m.text} frequency ${d.freq} vs ${m.f0}`);
        assert.ok(Math.abs(d.dt - m.dt) < 0.09, `${m.text} DT ${d.dt} vs ${m.dt}`);
        assert.ok(Math.abs(d.snr - m.snrDb) < 2.5, `${m.text} SNR ${d.snr.toFixed(1)} vs ${m.snrDb}`);
    }
});
