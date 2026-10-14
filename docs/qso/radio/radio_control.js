// Radio control for the page: connects over Web Serial (or a fake), keys PTT for the
// transmitter, and reads or sets the dial frequency when CAT is used. No DOM.
//
// Methods: 'vox'  no radio control (the radio keys itself from the audio)
//          'cat'  Kenwood TS-480 CAT (QMX, (tr)uSDX, Kenwood)
//          'rts' / 'dtr'  key PTT with a serial control line (Digirig and similar)

import { SerialLink } from './serial_link.js';
import { KenwoodRadio, MODE } from './kenwood.js';
import { FakeKenwoodPort } from './fake_kenwood.js';

export class RadioControl extends EventTarget {
    constructor({ fake = false } = {}) {
        super();
        this.fake = fake;
        this.method = 'vox';
        this.link = null;
        this.radio = null;     // KenwoodRadio when method is 'cat'
        this.port = null;
        this.pttOn = false;
        this.error = '';
    }

    static get available() {
        return !!navigator.serial;
    }

    get connected() {
        return this.method === 'vox' || !!this.link;
    }

    get frequency() {
        return this.radio?.frequency ?? null;
    }

    get label() {
        if (this.method === 'vox') return 'No radio control (VOX)';
        if (!this.link) return 'Not connected';
        if (this.radio) return `${this.radio.model}${this.fake ? ' (simulated)' : ''}`;
        return `${this.method.toUpperCase()} line on the serial port`;
    }

    /** Must be called from a click: the browser shows its list of serial ports. */
    async connect(method, { baudRate = 115200, digitalMode = true } = {}) {
        await this.disconnect();
        this.method = method;
        this.error = '';
        if (method === 'vox') { this.changed(); return; }
        try {
            if (this.fake) {
                this.port = new FakeKenwoodPort();
            } else {
                this.port = await navigator.serial.requestPort();
                await this.port.open({ baudRate });
            }
            this.link = new SerialLink(this.port);
            if (method === 'cat') {
                this.radio = new KenwoodRadio(this.link);
                await this.radio.connect();
                // A QMX transmits clean FSK from USB audio in its Digi (FSK) mode.
                if (digitalMode) await this.radio.setMode(this.radio.model === 'QRP Labs QMX' ? MODE.FSK : MODE.USB);
            } else {
                await this.link.setLine(method, false);
            }
        } catch (err) {
            this.error = err.name === 'NotFoundError' ? 'No serial port was chosen.' : err.message;
            await this.disconnect(true);
            throw new Error(this.error);
        } finally {
            this.changed();
        }
    }

    async disconnect(keepError = false) {
        if (this.pttOn) await this.ptt(false).catch(() => {});
        const link = this.link;
        this.link = null;
        this.radio = null;
        this.port = null;
        if (!keepError) this.error = '';
        await link?.close().catch(() => {});
        this.changed();
    }

    async setFrequency(hz) {
        if (!this.radio) return null;
        const f = await this.radio.setFrequency(hz);
        this.changed();
        return f;
    }

    async refresh() {
        if (!this.radio || this.pttOn) return; // don't poll during TX
        try { await this.radio.getFrequency(); this.changed(); } catch { /* try again next time */ }
    }

    /** Keys or unkeys the transmitter. Throws if the radio can't be reached. */
    async ptt(on) {
        if (this.method === 'vox' || !this.link) { this.pttOn = on; return; }
        this.pttOn = on;
        if (this.radio) await this.radio.ptt(on);
        else await this.link.setLine(this.method, on);
        this.changed();
    }

    changed() {
        this.dispatchEvent(new CustomEvent('change'));
    }
}
