// Receive panel: chooses where audio comes from (sound card, RTL-SDR, test signals or an
// audio file), starts and stops it, and shows the receive status line and input level.
// The status line also shows errors from the other panels (see showError).
//
// Each input is a module in ui/inputs/ with the same shape: kind, realSignals, help,
// levelWarning, show(on), start({clock, onAudio, onError}) -> source, status(source),
// startError(err) -> message or null. The audio file input has opensFile and open() instead
// of start(). The Dial frequency list (DialControl) is shared by all inputs.
//
// Events: 'change' when a source starts or stops.

import { SoundCardInput } from './inputs/sound_card_input.js';
import { RtlSdrInput } from './inputs/rtlsdr_input.js';
import { TestSignalsInput } from './inputs/test_input.js';
import { AudioFileInput } from './inputs/file_input.js';
import { DialControl } from './dial_control.js';
import { $, store } from './dom.js';

export class ReceivePanel extends EventTarget {
    /**
     * @param {{clock: import('../slot_clock.js').SlotClock, pipeline: import('../rx_pipeline.js').RxPipeline,
     *          dial: import('../dial.js').Dial, cat: () => boolean, fakeRtl?: boolean}} options
     *   cat: true while radio control (CAT) reads and sets the radio's frequency
     *   fakeRtl: use a simulated RTL-SDR (?fake-rtlsdr)
     */
    constructor({ clock, pipeline, dial, cat, fakeRtl = false }) {
        super();
        this.clock = clock;
        this.pipeline = pipeline;
        this.source = null;       // running live source
        this.kind = null;         // kind of the running input
        this.error = '';

        const running = (kind) => () => (this.kind === kind ? this.source : null);
        this.inputs = {
            soundcard: new SoundCardInput({
                dial, cat,
                restart: async () => { if (this.kind === 'soundcard') { await this.stop(); await this.start(); } },
            }),
            rtlsdr: new RtlSdrInput({ dial, fake: fakeRtl, running: running('rtlsdr'), changed: () => this.render() }),
            test: new TestSignalsInput(),
            file: new AudioFileInput({
                clock, pipeline,
                setState: (text) => { this.error = ''; this.setState(text); },
                showError: (message) => this.showError(message),
            }),
        };

        this.dialControl = new DialControl({ dial, cat });
        // The sound card's status line shows the dial frequency.
        dial.addEventListener('change', () => { if (this.kind === 'soundcard') this.render(); });
        this.setUpSourceChoice();
        $('rx-toggle').addEventListener('click', async () => {
            if (this.input.opensFile) { this.input.open(); return; }
            if (this.source) await this.stop(); else await this.start();
        });
    }

    /** True while receiving the simulated test signals (nothing is really transmitted). */
    get testMode() {
        return !!this.source && this.kind === 'test';
    }

    /** True when decodes come from real signals, which can be used to correct the clock. */
    get realSignals() {
        return !!this.kind && this.inputs[this.kind].realSignals;
    }

    get selectedKind() {
        return document.querySelector('input[name="source"]:checked').value;
    }

    /** The chosen input (which may not be running). */
    get input() {
        return this.inputs[this.selectedKind];
    }

    setUpSourceChoice() {
        const saved = document.querySelector(`input[name="source"][value="${store.get('source', 'test')}"]`);
        if (saved) saved.checked = true;
        document.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener('change', async () => {
            await this.stop();
            store.set('source', this.selectedKind);
            this.render();
        }));
    }

    async start() {
        this.error = '';
        const input = this.input;
        const { clock, pipeline } = this;
        try {
            await pipeline.start();
            const onAudio = (samples, startTime) => pipeline.pushAudio(samples, startTime);
            const onError = (message) => { this.showError(message); this.stop(); };
            this.source = await input.start({ clock, onAudio, onError });
            this.kind = input.kind;
        } catch (err) {
            this.source = null;
            this.kind = null;
            this.showError(input.startError(err) ?? `Could not start receiving: ${err.message}`);
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
        const { source } = this;
        const input = this.input;
        for (const i of Object.values(this.inputs)) i.show(i === input);
        this.renderDialChoice();
        $('rx-toggle').textContent = input.opensFile ? 'Open audio file…' : source ? 'Stop receiving' : 'Start receiving';
        $('level-wrap').hidden = !source;

        if (this.error) this.setState(this.error, 'error');
        else if (source) this.setState(this.inputs[this.kind].status(source), 'running');
        else if (!input.opensFile) this.setState('Not receiving');
        this.dispatchEvent(new CustomEvent('change'));
    }

    /** The Dial frequency list and help, which depend on radio control (called when it changes). */
    renderDialChoice() {
        this.dialControl.render(this.selectedKind);
        $('source-help').textContent = this.input.help;
        // Hide the settings row when the chosen input has no settings.
        $('rx-settings').hidden = [...$('rx-settings').children].every((el) => el.hidden);
    }

    /** Input level meter; called about 10 times a second. */
    renderLevel() {
        const { source } = this;
        if (!source) return;
        $('level').value = Math.max(-60, Math.min(0, source.level));
        let text = Number.isFinite(source.level) ? `${source.level.toFixed(0)} dBFS` : '';
        if (source.level > -1) text += this.inputs[this.kind].levelWarning;
        $('level-db').textContent = text;
    }
}
