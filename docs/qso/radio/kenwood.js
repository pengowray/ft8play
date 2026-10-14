// Kenwood TS-480 style CAT, as used by the QRP Labs QMX and the (tr)uSDX.
// Commands end with ';' and never include CR or LF (a CR switches a QMX port to terminal mode).
//
// Used here: FA (VFO A frequency, 11 digits), MD (mode: 2 = USB, 6 = FSK/Digi on a QMX),
// TX / RX (key and unkey), IF (status), ID (radio ID), OM (QRP Labs model).

export const MODE = { LSB: 1, USB: 2, CW: 3, FSK: 6 };

export class KenwoodRadio {
    /** @param {import('./serial_link.js').SerialLink} link */
    constructor(link) {
        this.link = link;
        this.model = '';
        this.frequency = null;
        this.mode = null;
        this.transmitting = false;
    }

    /** Checks the radio answers, and reads its identity, frequency and mode. */
    async connect() {
        const id = await this.link.request('ID;');
        this.model = id === 'ID020;' ? 'Kenwood TS-480 compatible' : id.slice(2, -1);
        try {
            const om = await this.link.request('OM;', { timeoutMs: 400 });
            if (om === 'OMQC;') this.model = 'QRP Labs QMX';
        } catch { /* not a QRP Labs radio */ }
        await this.readStatus();
        return this.model;
    }

    /** Reads frequency, mode and TX state from the IF reply. */
    async readStatus() {
        const r = await this.link.request('IF;');
        // IF + 11-digit frequency + 5 spaces + RIT (5) + RIT on + XIT on + bank + channel (2)
        //    + TX status + mode + ...
        const body = r.slice(2, -1);
        this.frequency = Number(body.slice(0, 11));
        this.transmitting = body[26] === '1';
        this.mode = Number(body[27]);
        return { frequency: this.frequency, mode: this.mode, transmitting: this.transmitting };
    }

    async getFrequency() {
        const r = await this.link.request('FA;');
        this.frequency = Number(r.slice(2, -1));
        return this.frequency;
    }

    async setFrequency(hz) {
        await this.link.send(`FA${String(Math.round(hz)).padStart(11, '0')};`);
        this.frequency = await this.getFrequency();
        return this.frequency;
    }

    async setMode(mode) {
        await this.link.send(`MD${mode};`);
        this.mode = mode;
    }

    async ptt(on) {
        await this.link.send(on ? 'TX;' : 'RX;');
        this.transmitting = on;
    }

    async close() {
        if (this.transmitting) await this.ptt(false).catch(() => {});
        await this.link.close();
    }
}
