// A pretend Kenwood/QMX serial port, with the same readable/writable/setSignals shape as a
// Web Serial port. For tests, and for trying radio control without a radio (?fake-radio).

export class FakeKenwoodPort {
    constructor({ model = 'QMX', frequency = 14074000 } = {}) {
        this.model = model;
        this.frequency = frequency;
        this.mode = 2;
        this.tx = false;
        this.log = [];          // commands received, in order
        this.signals = {};
        const encoder = new TextEncoder();
        let controller;
        this.readable = new ReadableStream({ start: (c) => { controller = c; } });
        const reply = (text) => setTimeout(() => { try { controller.enqueue(encoder.encode(text)); } catch { /* closed */ } }, 5);
        const decoder = new TextDecoder();
        let pending = '';
        this.writable = new WritableStream({
            write: (chunk) => {
                pending += decoder.decode(chunk, { stream: true });
                if (pending.includes('\r')) throw new Error('CR sent: a QMX port would switch to terminal mode');
                let end;
                while ((end = pending.indexOf(';')) >= 0) {
                    const cmd = pending.slice(0, end + 1);
                    pending = pending.slice(end + 1);
                    this.log.push(cmd);
                    const r = this.handle(cmd);
                    if (r) reply(r);
                }
            },
        });
        this.closeReadable = () => { try { controller.close(); } catch { /* already closed */ } };
    }

    handle(cmd) {
        const name = cmd.slice(0, 2), arg = cmd.slice(2, -1);
        switch (name) {
            case 'ID': return 'ID020;';
            case 'OM': return this.model === 'QMX' ? 'OMQC;' : null;
            case 'FA':
                if (arg) { this.frequency = Number(arg); return null; }
                return `FA${String(this.frequency).padStart(11, '0')};`;
            case 'MD':
                if (arg) { this.mode = Number(arg); return null; }
                return `MD${this.mode};`;
            case 'TX': this.tx = true; return null;
            case 'RX': this.tx = false; return null;
            case 'IF':
                // frequency, 5 spaces, RIT +0000, RIT on, XIT on, bank, channel (2), TX, mode,
                // VFO, scan, split, tone, tone number (2), space
                return `IF${String(this.frequency).padStart(11, '0')}     +000000000${this.tx ? 1 : 0}${this.mode}000000 ;`;
            default: return null;
        }
    }

    async setSignals(s) { Object.assign(this.signals, s); }
    async close() { this.closeReadable(); }
}
