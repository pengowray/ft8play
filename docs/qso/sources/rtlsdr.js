// RTL-SDR input over WebUSB (Chromium on desktop and Android): reads IQ samples, converts
// them to upper-sideband audio at 12 kHz, and passes the audio on with timestamps, like a
// radio's sound card would.
//
// HF: an RTL-SDR Blog V4 uses its built-in upconverter (handled by the driver); a V3 or other
// R820T stick switches to direct sampling (Q branch) below the tuner's range.

import { RTL2832U_Provider, DirectSampling } from '../../vendor/webrtlsdr/rtlsdr.js';
import { IqToUsbAudio } from '../dsp/iq_to_audio.js';

/** Common FT8 dial frequencies (upper sideband). */
export const FT8_DIAL_FREQUENCIES = [
    { band: '160 m', hz: 1840000 },
    { band: '80 m', hz: 3573000 },
    { band: '60 m', hz: 5357000 },
    { band: '40 m', hz: 7074000 },
    { band: '30 m', hz: 10136000 },
    { band: '20 m', hz: 14074000 },
    { band: '17 m', hz: 18100000 },
    { band: '15 m', hz: 21074000 },
    { band: '12 m', hz: 24915000 },
    { band: '10 m', hz: 28074000 },
    { band: '6 m', hz: 50313000 },
    { band: '2 m', hz: 144174000 },
];

const SAMPLE_RATE = 240000;  // 20 x 12 kHz; within the RTL2832U's 225-300 kS/s range
const OFFSET_HZ = 20000;     // tune this far above the dial, so the DC spike stays out of the audio
const READ_SAMPLES = 24576;  // about 0.1 s per read; 49152 bytes, a multiple of the 512-byte USB packet
// Group delay of IqToUsbAudio's filters (331 taps at 12 kHz, 45 at 48 kHz, 43 at 240 kHz).
const FILTER_DELAY_MS = (165 / 12000 + 22 / 48000 + 21 / 240000) * 1000;

export class RtlSdrSource {
    /**
     * @param {{clock: import('../slot_clock.js').SlotClock, onAudio: (samples: Float32Array, startTime: number) => void,
     *          dialHz: number, gainDb?: number|null, ppm?: number, provider?: object}} options
     *   gainDb: tuner gain, or null for automatic. provider: for tests (see fake_rtlsdr.js).
     */
    constructor({ clock, onAudio, dialHz, gainDb = null, ppm = 0, provider = null }) {
        this.clock = clock;
        this.onAudio = onAudio;
        this.dialHz = dialHz;
        this.gainDb = gainDb;
        this.ppm = ppm;
        this.provider = provider ?? new RTL2832U_Provider();
        this.device = null;
        this.running = false;
        this.loop = null;
        this.level = -Infinity;   // peak IQ level of the last read, dBFS (0 = ADC full scale)
        this.deviceLabel = 'RTL-SDR';
    }

    async start() {
        if (this.running) return;
        this.device = await this.provider.get();
        const d = this.device;
        await d.setSampleRate(SAMPLE_RATE);
        await d.setFrequencyCorrection(this.ppm);
        await d.setDirectSamplingMethod(DirectSampling.Q);
        await d.setGain(this.gainDb);
        await d.setCenterFrequency(this.dialHz + OFFSET_HZ);
        await d.resetBuffer();
        this.updateLabel();
        this.converter = new IqToUsbAudio({ inputRate: SAMPLE_RATE, offsetHz: OFFSET_HZ });
        this.running = true;
        this.loop = this.readLoop();
    }

    async readLoop() {
        const blockMs = READ_SAMPLES / SAMPLE_RATE * 1000;
        let anchor = null;   // device time (ms) of input sample 0
        let inputCount = 0;  // input samples read so far
        let outputCount = 0; // audio samples produced so far
        while (this.running) {
            let block;
            try {
                block = await this.device.readSamples(READ_SAMPLES);
            } catch (err) {
                if (this.running) this.onError?.(err);
                break;
            }
            if (!this.running) break;
            const now = Date.now();
            // Times come from a sample count anchored to the first read, re-anchored if the
            // count drifts from the clock by more than a quarter second (e.g. dropped samples).
            const expectedEnd = anchor + (inputCount + READ_SAMPLES) / SAMPLE_RATE * 1000;
            if (anchor == null || Math.abs(now - expectedEnd) > 250) {
                anchor = now - blockMs - inputCount / SAMPLE_RATE * 1000;
            }
            const iq = new Uint8Array(block.data);
            let peak = 0;
            for (let i = 0; i < iq.length; i++) {
                const v = Math.abs(iq[i] - 127.5);
                if (v > peak) peak = v;
            }
            this.level = 20 * Math.log10(peak / 127.5 || 1e-9);

            const audio = this.converter.processU8(iq);
            const startTime = anchor + (outputCount / 12000) * 1000 - FILTER_DELAY_MS;
            inputCount += READ_SAMPLES;
            outputCount += audio.length;
            this.onAudio(audio, startTime + this.clock.offsetMs);
        }
    }

    updateLabel() {
        const d = this.device;
        const name = d?.tuner?.isRtlSdrBlogV4 ? 'RTL-SDR Blog V4' : 'RTL-SDR';
        this.deviceLabel = d?.directSampling ? `${name}, direct sampling` : name;
    }

    /** Retunes while running. */
    async setDial(hz) {
        this.dialHz = hz;
        if (this.device) {
            await this.device.setCenterFrequency(hz + OFFSET_HZ);
            this.updateLabel();
        }
    }

    async setGain(gainDb) {
        this.gainDb = gainDb;
        if (this.device) await this.device.setGain(gainDb);
    }

    async stop() {
        this.running = false;
        await this.loop?.catch(() => {});
        await this.device?.close().catch(() => {});
        this.device = null;
    }
}
