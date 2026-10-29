// RTL-SDR input for the receive panel: band and gain lists, and starting an RtlSdrSource
// (or a simulated stick with ?fake-rtlsdr).

import { RtlSdrSource } from '../../sources/rtlsdr.js';
import { FakeRtlProvider } from '../../sources/fake_rtlsdr.js';
import { bandName } from '../../bands.js';
import { $, store, bandOptions, formatMHz } from '../dom.js';

const HELP = 'Receives from an RTL-SDR USB stick connected to an antenna, in upper sideband on the chosen FT8 frequency. HF works on an RTL-SDR Blog V3 or V4 (other sticks need a direct-sampling modification). Works in Chrome and Edge on a computer, and in Chrome on Android. When you press Start receiving, the browser asks which USB device to use.';
const GAINS = ['auto', 0, 10, 20, 30, 40, 49];

export class RtlSdrInput {
    kind = 'rtlsdr';
    help = HELP;
    levelWarning = ' · overloaded, choose a lower gain';

    /**
     * @param {{fake: boolean, running: () => RtlSdrSource|null, changed: () => void}} options
     *   fake: use a simulated RTL-SDR; running: the source while this input is receiving;
     *   changed: call after retuning, to update the status line
     */
    constructor({ fake, running, changed }) {
        this.fake = fake;
        this.realSignals = !fake;
        this.bandSelect = $('rtl-band');
        this.gainSelect = $('rtl-gain');
        const { bandSelect, gainSelect } = this;

        if (!navigator.usb && !fake) {
            const rtl = document.querySelector('input[name="source"][value="rtlsdr"]');
            rtl.disabled = true;
            rtl.parentElement.title = 'This browser has no WebUSB. Use Chrome or Edge on a computer, or Chrome on Android.';
            rtl.parentElement.classList.add('unavailable');
        }

        bandSelect.replaceChildren(...bandOptions());
        bandSelect.value = store.get('rtlDial', '14074000');
        bandSelect.addEventListener('change', async () => {
            store.set('rtlDial', bandSelect.value);
            const source = running();
            if (source) {
                await source.setDial(Number(bandSelect.value));
                changed();
            }
        });
        gainSelect.replaceChildren(...GAINS.map((g) => new Option(g === 'auto' ? 'Gain: automatic' : `Gain: ${g} dB`, g)));
        gainSelect.value = store.get('rtlGain', 'auto');
        gainSelect.addEventListener('change', async () => {
            store.set('rtlGain', gainSelect.value);
            await running()?.setGain(this.gainDb);
        });
    }

    get gainDb() {
        return this.gainSelect.value === 'auto' ? null : Number(this.gainSelect.value);
    }

    get dialHz() {
        return Number(this.bandSelect.value);
    }

    show(on) {
        this.bandSelect.hidden = !on;
        this.gainSelect.hidden = !on;
    }

    async start({ clock, onAudio, onError }) {
        const source = new RtlSdrSource({
            clock, onAudio, dialHz: this.dialHz, gainDb: this.gainDb,
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
