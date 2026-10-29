// RTL-SDR input for the receive panel: the gain list, tuning to the Dial frequency, and
// starting an RtlSdrSource (or a simulated stick with ?fake-rtlsdr).

import { RtlSdrSource } from '../../sources/rtlsdr.js';
import { FakeRtlProvider } from '../../sources/fake_rtlsdr.js';
import { bandName } from '../../bands.js';
import { $, store, formatMHz } from '../dom.js';

const HELP = 'Receives from an RTL-SDR USB stick connected to an antenna, in upper sideband on the chosen FT8 frequency. HF works on an RTL-SDR Blog V3 or V4 (other sticks need a direct-sampling modification). Works in Chrome and Edge on a computer, and in Chrome on Android. When you press Start receiving, the browser asks which USB device to use.';
const GAINS = ['auto', 0, 10, 20, 30, 40, 49];

export class RtlSdrInput {
    kind = 'rtlsdr';
    help = HELP;
    levelWarning = ' · overloaded, choose a lower gain';

    /**
     * @param {{dial: import('../../dial.js').Dial, fake: boolean, running: () => RtlSdrSource|null,
     *          changed: () => void}} options
     *   fake: use a simulated RTL-SDR; running: the source while this input is receiving;
     *   changed: call after retuning, to update the status line
     */
    constructor({ dial, fake, running, changed }) {
        this.dial = dial;
        this.fake = fake;
        this.realSignals = !fake;
        this.field = $('rtl-gain-field');
        this.gainSelect = $('rtl-gain');
        const { gainSelect } = this;

        if (!navigator.usb && !fake) {
            const rtl = document.querySelector('input[name="source"][value="rtlsdr"]');
            rtl.disabled = true;
            rtl.parentElement.title = 'This browser has no WebUSB. Use Chrome or Edge on a computer, or Chrome on Android.';
            rtl.parentElement.classList.add('unavailable');
        }

        // Follow the dial, whether the user or the radio (CAT) changed it.
        dial.addEventListener('change', async (e) => {
            const { hz, from } = e.detail;
            if (!hz) return;
            if (from === 'user') store.set('rtlDial', hz);
            const source = running();
            if (source && source.dialHz !== hz) {
                await source.setDial(hz);
                changed();
            }
        });
        gainSelect.replaceChildren(...GAINS.map((g) => new Option(g === 'auto' ? 'Automatic' : `${g} dB`, g)));
        gainSelect.value = store.get('rtlGain', 'auto');
        gainSelect.addEventListener('change', async () => {
            store.set('rtlGain', gainSelect.value);
            await running()?.setGain(this.gainDb);
        });
    }

    get gainDb() {
        return this.gainSelect.value === 'auto' ? null : Number(this.gainSelect.value);
    }

    show(on) {
        this.field.hidden = !on;
        // The RTL-SDR needs a frequency: use the last one it was tuned to.
        if (on && !this.dial.hz) this.dial.set(Number(store.get('rtlDial', '14074000')));
    }

    async start({ clock, onAudio, onError }) {
        const source = new RtlSdrSource({
            clock, onAudio, dialHz: this.dial.hz, gainDb: this.gainDb,
            provider: this.fake ? new FakeRtlProvider({ clock }) : undefined,
        });
        source.onError = (err) => onError(`RTL-SDR stopped: ${err.message}`);
        await source.start();
        return source;
    }

    status(source) {
        const band = bandName(source.dialHz);
        return `Receiving from ${this.fake ? 'simulated ' : ''}${source.deviceLabel} on ${formatMHz(source.dialHz)}${band ? ` (${band})` : ''}`;
    }

    startError(err) {
        if (err.name === 'NotFoundError') {
            return 'No RTL-SDR was chosen. Plug it in, press Start receiving, and choose it in the browser\'s list of USB devices.';
        }
        if (/claim|access|busy|SecurityError/i.test(`${err.name} ${err.message}`)) {
            return `Could not open the RTL-SDR: ${err.message}. Close any other program that is using it. On Windows, install the WinUSB driver for it with Zadig. On Linux, unload the TV driver (sudo rmmod dvb_usb_rtl28xxu) and allow access with a udev rule.`;
        }
        return null;
    }
}
