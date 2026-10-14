// Radio control panel (connect over Web Serial, band, status), and PTT: keying the radio
// when the transmitter starts and stops.

import { RadioControl } from '../radio/radio_control.js';
import { FT8_DIAL_FREQUENCIES } from '../sources/rtlsdr.js';
import { $, store, bandOptions, formatMHz } from './dom.js';

const POLL_MS = 2000; // read the radio's frequency this often (not while transmitting)

export class RadioPanel {
    /** @param {{radio: RadioControl, onError: (message: string) => void}} options */
    constructor({ radio, onError }) {
        this.radio = radio;
        this.method = $('radio-method');
        this.method.value = store.get('radioMethod', 'vox');
        $('radio-baud').value = store.get('radioBaud', '115200');
        $('radio-band').replaceChildren(new Option('Choose a band', ''), ...bandOptions());

        this.method.addEventListener('change', () => { store.set('radioMethod', this.method.value); this.render(); });
        $('radio-baud').addEventListener('change', (e) => store.set('radioBaud', e.target.value));
        $('radio-connect').addEventListener('click', async () => {
            try {
                await radio.connect(this.method.value, { baudRate: Number($('radio-baud').value) });
            } catch (err) {
                onError(`Radio: ${err.message}`);
            }
        });
        $('radio-disconnect').addEventListener('click', () => radio.disconnect());
        $('radio-band').addEventListener('change', async (e) => {
            if (!e.target.value) return;
            try { await radio.setFrequency(Number(e.target.value)); } catch (err) { onError(`Radio: ${err.message}`); }
        });
        radio.addEventListener('change', () => this.render());
        setInterval(() => radio.refresh(), POLL_MS);
        this.render();
    }

    render() {
        const { radio } = this;
        const method = this.method.value;
        const usesPort = method !== 'vox';
        const connected = !!radio.link;
        $('radio-connect').hidden = !usesPort || connected;
        $('radio-connect').disabled = !RadioControl.available && !radio.fake;
        $('radio-disconnect').hidden = !connected;
        $('radio-baud').parentElement.hidden = !usesPort;
        $('radio-cat-fields').hidden = !(connected && radio.radio);
        const f = radio.frequency;
        $('radio-freq').textContent = f ? `Dial ${formatMHz(f, 6)}` : '';
        if (f) $('radio-band').value = FT8_DIAL_FREQUENCIES.some(b => b.hz === f) ? f : '';
        $('radio-summary').textContent = method === 'vox' ? 'none (VOX)'
            : connected ? `${radio.label}${f ? ` · ${formatMHz(f)}` : ''}`
            : 'not connected';
        let help = '';
        if (!RadioControl.available && !radio.fake && usesPort) help = 'This browser has no Web Serial. Use Chrome or Edge on a computer, or Chrome 148 or later on Android.';
        else if (method === 'vox') help = 'The page plays the transmit audio, and the radio\'s VOX must switch it to transmit. A QMX in Digi mode switches to transmit when audio arrives over USB.';
        else if (method === 'cat') help = 'Choose the radio\'s serial port. A QMX has up to three serial ports; choose the first. The page sets the radio to Digi mode (QMX) or upper sideband (other radios), switches it between transmit and receive with the TX; and RX; commands, and can change its frequency.';
        else help = `Keys PTT by turning on the serial port's ${method.toUpperCase()} line while transmitting.`;
        $('radio-help').textContent = radio.error ? `${radio.error} ${help}` : help;
    }
}

/**
 * Keys the radio while the transmitter is on air. If the radio can't be keyed, transmitting
 * stops. In test mode the radio is never keyed: transmissions only go to the simulated band.
 * @param {{transmitter: import('../tx.js').Transmitter, radio: RadioControl, testMode: () => boolean,
 *          halt: () => void, onError: (message: string) => void}} options
 */
export function connectPtt({ transmitter, radio, testMode, halt, onError }) {
    transmitter.addEventListener('ptton', async () => {
        if (testMode()) return;
        try { await radio.ptt(true); } catch (err) { halt(); onError(`PTT failed, transmit stopped: ${err.message}`); }
    });
    transmitter.addEventListener('pttoff', async () => {
        if (!radio.pttOn) return;
        try {
            await radio.ptt(false);
        } catch {
            await new Promise(r => setTimeout(r, 500)); // one retry
            try { await radio.ptt(false); } catch (err) {
                onError(`Could not unkey the radio: ${err.message}. The radio may still be transmitting. Switch it to receive with its own controls, or turn it off.`);
            }
        }
    });
    window.addEventListener('pagehide', () => { halt(); radio.ptt(false).catch(() => {}); });
}
