// Receive panel: chooses where audio comes from (sound card, RTL-SDR, test signals or an
// audio file), starts and stops it, and shows the receive status line and input level.
// The status line also shows errors from the other panels (see showError).
//
// Events: 'change' when a source starts or stops.

import { TestSignalSource } from '../sources/test_signals.js';
import { SoundCardSource, listInputDevices } from '../sources/sound_card.js';
import { readAudioFile } from '../sources/wav_file.js';
import { RtlSdrSource } from '../sources/rtlsdr.js';
import { FakeRtlProvider } from '../sources/fake_rtlsdr.js';
import { $, store, bandOptions, bandName, formatMHz } from './dom.js';

const HELP = {
    soundcard: 'Receives audio from a sound card input, such as a radio\'s USB audio. Set the radio to upper sideband (USB) on an FT8 frequency, for example 14.074 MHz. The browser will ask for microphone permission.',
    rtlsdr: 'Receives from an RTL-SDR USB stick connected to an antenna, in upper sideband on the chosen FT8 frequency. HF works on an RTL-SDR Blog V3 or V4 (other sticks need a direct-sampling modification). Works in Chrome and Edge on a computer, and in Chrome on Android. When you press Start receiving, the browser asks which USB device to use.',
    test: 'Simulated FT8 signals mixed with noise, for trying the page without a radio. A simulated station, WA9XYZ, calls CQ and answers your CQ.',
    file: 'Decodes the first 15 s of a recording. The recording must start at the beginning of a slot (:00, :15, :30 or :45 past the minute), such as a WAV file saved by WSJT-X.',
};
const GAINS = ['auto', 0, 10, 20, 30, 40, 49];

export class ReceivePanel extends EventTarget {
    /**
     * @param {{clock: import('../slot_clock.js').SlotClock, pipeline: import('../rx_pipeline.js').RxPipeline,
     *          fakeRtl?: boolean}} options  fakeRtl: use a simulated RTL-SDR (?fake-rtlsdr)
     */
    constructor({ clock, pipeline, fakeRtl = false }) {
        super();
        this.clock = clock;
        this.pipeline = pipeline;
        this.fakeRtl = fakeRtl;
        this.source = null;       // running live source
        this.kind = null;         // 'soundcard' | 'rtlsdr' | 'test' while running
        this.error = '';
        this.pendingFile = null;  // { label, seconds } while an audio file is being decoded
        this.bandSelect = $('rtl-band');
        this.gainSelect = $('rtl-gain');

        this.setUpSourceChoice();
        this.setUpRtlControls();
        this.setUpButtons();
        pipeline.addEventListener('decodes', (e) => this.onDecodes(e.detail));
    }

    /** True while receiving the simulated test signals (nothing is really transmitted). */
    get testMode() {
        return !!this.source && this.kind === 'test';
    }

    /** True when decodes come from real signals, which can be used to correct the clock. */
    get realSignals() {
        return this.kind === 'soundcard' || (this.kind === 'rtlsdr' && !this.fakeRtl);
    }

    /** The RTL-SDR's dial frequency while receiving from one, else null. */
    get dialHz() {
        return this.kind === 'rtlsdr' && this.source ? this.source.dialHz : null;
    }

    get selectedKind() {
        return document.querySelector('input[name="source"]:checked').value;
    }

    get selectedGain() {
        return this.gainSelect.value === 'auto' ? null : Number(this.gainSelect.value);
    }

    setUpSourceChoice() {
        const saved = document.querySelector(`input[name="source"][value="${store.get('source', 'test')}"]`);
        if (saved) saved.checked = true;
        document.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener('change', async () => {
            await this.stop();
            store.set('source', this.selectedKind);
            this.render();
        }));
        if (!navigator.usb && !this.fakeRtl) {
            const rtl = document.querySelector('input[name="source"][value="rtlsdr"]');
            rtl.disabled = true;
            rtl.parentElement.title = 'This browser has no WebUSB. Use Chrome or Edge on a computer, or Chrome on Android.';
            rtl.parentElement.classList.add('unavailable');
        }
        $('input-device').addEventListener('change', async (e) => {
            store.set('inputDevice', e.target.value);
            if (this.kind === 'soundcard') { await this.stop(); await this.start(); }
        });
    }

    setUpRtlControls() {
        const { bandSelect, gainSelect } = this;
        bandSelect.replaceChildren(...bandOptions());
        bandSelect.value = store.get('rtlDial', '14074000');
        bandSelect.addEventListener('change', async () => {
            store.set('rtlDial', bandSelect.value);
            if (this.kind === 'rtlsdr') {
                await this.source.setDial(Number(bandSelect.value));
                this.render();
            }
        });
        gainSelect.replaceChildren(...GAINS.map((g) => new Option(g === 'auto' ? 'Gain: automatic' : `Gain: ${g} dB`, g)));
        gainSelect.value = store.get('rtlGain', 'auto');
        gainSelect.addEventListener('change', async () => {
            store.set('rtlGain', gainSelect.value);
            if (this.kind === 'rtlsdr') await this.source.setGain(this.selectedGain);
        });
    }

    setUpButtons() {
        $('rx-toggle').addEventListener('click', async () => {
            if (this.selectedKind === 'file') { $('file-input').click(); return; }
            if (this.source) await this.stop(); else await this.start();
        });
        $('file-input').addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) await this.decodeFile(file);
        });
    }

    async fillDeviceList() {
        const select = $('input-device');
        const devices = await listInputDevices();
        const saved = store.get('inputDevice');
        select.replaceChildren(...devices.map((d, i) =>
            new Option(d.label || (i === 0 ? 'Default input' : `Input ${i + 1}`), d.deviceId, false, d.deviceId === saved)));
    }

    async decodeFile(file) {
        this.error = '';
        this.setState(`Decoding ${file.name}…`);
        try {
            await this.pipeline.start();
            const { samples, seconds } = await readAudioFile(file, this.clock.mode.sampleRate);
            // Shown on the waterfall like live audio. The status changes to "Decoded" when the
            // decoder's results arrive (see onDecodes).
            this.pendingFile = { label: file.name, seconds };
            this.pipeline.decodeRecording(samples, file.name);
        } catch (err) {
            this.showError(`Could not read ${file.name}: ${err.message}`);
        }
    }

    onDecodes(result) {
        if (!this.pendingFile || result.label !== this.pendingFile.label) return;
        const { label, seconds } = this.pendingFile;
        this.pendingFile = null;
        this.setState(seconds > this.clock.mode.slotSeconds + 1
            ? `Decoded the first 15 s of ${label} (${seconds.toFixed(0)} s long)`
            : `Decoded ${label}`);
    }

    async start() {
        this.error = '';
        const kind = this.selectedKind;
        const { clock, pipeline } = this;
        try {
            await pipeline.start();
            const onAudio = (samples, startTime) => pipeline.pushAudio(samples, startTime);
            if (kind === 'test') {
                this.source = new TestSignalSource({ clock, onAudio });
                this.source.start();
            } else if (kind === 'rtlsdr') {
                this.source = new RtlSdrSource({
                    clock, onAudio, dialHz: Number(this.bandSelect.value), gainDb: this.selectedGain,
                    provider: this.fakeRtl ? new FakeRtlProvider({ clock }) : undefined,
                });
                this.source.onError = (err) => { this.showError(`RTL-SDR stopped: ${err.message}`); this.stop(); };
                await this.source.start();
            } else if (kind === 'soundcard') {
                this.source = new SoundCardSource({ clock, onAudio, deviceId: store.get('inputDevice') || null });
                await this.source.start();
                await this.fillDeviceList(); // labels are only available after permission is granted
            }
            this.kind = kind;
        } catch (err) {
            this.source = null;
            this.kind = null;
            this.showError(startError(kind, err));
        }
        this.render();
    }

    async stop() {
        if (!this.source) return;
        await this.source.stop();
        this.source = null;
        this.kind = null;
        this.pipeline.flush();
        this.render();
    }

    /** Shows an error in the status line until the next start. */
    showError(message) {
        this.error = message;
        this.render();
    }

    setState(text, cls = '') {
        const el = $('rx-state');
        el.textContent = text;
        el.className = `rx-state ${cls}`;
    }

    render() {
        const kind = this.selectedKind;
        const { source } = this;
        $('source-help').textContent = HELP[kind];
        $('input-device').hidden = kind !== 'soundcard';
        this.bandSelect.hidden = kind !== 'rtlsdr';
        this.gainSelect.hidden = kind !== 'rtlsdr';
        if (kind === 'soundcard' && !$('input-device').options.length) this.fillDeviceList();
        $('rx-toggle').textContent = kind === 'file' ? 'Open audio file…' : source ? 'Stop receiving' : 'Start receiving';
        $('level-wrap').hidden = !source;

        if (this.error) this.setState(this.error, 'error');
        else if (this.testMode) this.setState('Receiving test signals', 'running');
        else if (source && this.kind === 'rtlsdr') {
            const band = bandName(source.dialHz);
            this.setState(`Receiving from ${this.fakeRtl ? 'simulated ' : ''}${source.deviceLabel} on ${formatMHz(source.dialHz)}${band ? ` (${band})` : ''}`, 'running');
        } else if (source) this.setState(`Receiving from ${source.deviceLabel || 'sound card'}`, 'running');
        else if (kind !== 'file') this.setState('Not receiving');
        this.dispatchEvent(new CustomEvent('change'));
    }

    /** Input level meter; called about 10 times a second. */
    renderLevel() {
        const { source } = this;
        if (!source) return;
        $('level').value = Math.max(-60, Math.min(0, source.level));
        let text = Number.isFinite(source.level) ? `${source.level.toFixed(0)} dBFS` : '';
        if (source.level > -1) text += this.kind === 'rtlsdr' ? ' · overloaded, choose a lower gain' : ' · clipping, lower the recording level';
        $('level-db').textContent = text;
    }
}

function startError(kind, err) {
    if (kind === 'soundcard' && err.name === 'NotAllowedError') {
        return 'Microphone permission was refused. Allow it in the browser\'s site settings, then try again.';
    }
    if (kind === 'rtlsdr' && err.name === 'NotFoundError') {
        return 'No RTL-SDR was chosen. Plug it in, press Start receiving, and choose it in the browser\'s list of USB devices.';
    }
    if (kind === 'rtlsdr' && /claim|access|busy|SecurityError/i.test(`${err.name} ${err.message}`)) {
        return `Could not open the RTL-SDR: ${err.message}. Close any other program that is using it. On Windows, install the WinUSB driver for it with Zadig. On Linux, unload the TV driver (sudo rmmod dvb_usb_rtl28xxu) and allow access with a udev rule.`;
    }
    return `Could not start receiving: ${err.message}`;
}
