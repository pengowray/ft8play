// QSO sequencer: decides what to send next, following WSJT-X's auto-sequencing for a
// standard FT8 QSO. No DOM; the page (or a simulated station) drives it.
//
// The six standard messages (WSJT-X Tx1 to Tx6), for my call M, my grid G, DX call D and the
// report R (D's signal-to-noise ratio as I measured it):
//   tx1  D M G       answer a CQ with my grid
//   tx2  D M R       send a report
//   tx3  D M R+R     acknowledge their report, send mine
//   tx4  D M RR73    acknowledge, and sign off
//   tx5  D M 73      sign off
//   tx6  CQ M G      call CQ
//
// Calling CQ:     tx6 ... they call me (grid) -> tx2 -> they send R+report -> tx4 -> done
//                 (they may skip their grid and send a report straight away -> tx3)
// Answering a CQ: tx1 -> they send a report -> tx3 -> they send RR73/RRR -> tx5 -> done
//                                            they send 73 -> done (no reply needed)
// A QSO is logged when it is complete: after sending RR73 (tx4) or 73 (tx5), or on hearing
// their 73 or RR73 after my R+report.

import { parseMessageParts } from '../ft8_parts.js';

export const STATE = {
    IDLE: 'idle',             // not transmitting
    CQ: 'cq',                 // calling CQ, waiting for a reply
    CALLING: 'calling',       // answering D's CQ (tx1), waiting for a report
    REPORT_SENT: 'report',    // sent tx2, waiting for R+report
    ROGER_SENT: 'roger',      // sent tx3, waiting for RR73/RRR/73
    SIGNING_OFF: 'signoff',   // about to send tx4 or tx5 (QSO complete once sent)
    DONE: 'done',             // QSO complete; nothing more to send
};

/** Report text as WSJT-X writes it: sign and two digits, -50 to +49. */
export function formatReport(snr) {
    const r = Math.max(-50, Math.min(49, Math.round(snr)));
    return `${r < 0 ? '-' : '+'}${String(Math.abs(r)).padStart(2, '0')}`;
}

const stripHash = (call) => (call || '').replace(/[<>]/g, '');

export class Sequencer {
    /**
     * @param {{myCall: string, myGrid?: string, maxRepeats?: number}} options
     *   maxRepeats: transmissions without an answer before giving up (WSJT-X's default
     *   watchdog is 6 minutes, 12 FT8 transmissions)
     */
    constructor({ myCall, myGrid = '', maxRepeats = 12 }) {
        this.myCall = myCall.toUpperCase();
        this.myGrid = (myGrid || '').toUpperCase().slice(0, 4);
        this.maxRepeats = maxRepeats;
        this.reset();
    }

    reset() {
        this.gaveUp = false;
        this.state = STATE.IDLE;
        this.dxCall = null;
        this.dxGrid = null;
        this.sentReport = null;     // report I send, e.g. '-11'
        this.rcvdReport = null;     // report they sent me
        this.nextKey = null;        // 'tx1'..'tx6'
        this.txEven = null;         // transmit in even (true) or odd (false) slots
        this.repeats = 0;           // transmissions since the last reply
        this.completed = null;      // log entry of the last completed QSO
    }

    /** The standard messages for the current DX station. */
    messages() {
        const D = this.dxCall ?? '', M = this.myCall, G = this.myGrid, R = this.sentReport ?? '-10';
        return {
            tx1: `${D} ${M} ${G}`.trim(),
            tx2: `${D} ${M} ${R}`,
            tx3: `${D} ${M} R${R}`,
            tx4: `${D} ${M} RR73`,
            tx5: `${D} ${M} 73`,
            tx6: `CQ ${M} ${G}`.trim(),
        };
    }

    /** What to send next: { key, text } or null. */
    get next() {
        if (!this.nextKey || this.state === STATE.IDLE || this.state === STATE.DONE) return null;
        return { key: this.nextKey, text: this.messages()[this.nextKey] };
    }

    /** Start calling CQ in even or odd slots. */
    callCq({ even }) {
        this.reset();
        this.state = STATE.CQ;
        this.nextKey = 'tx6';
        this.txEven = even;
    }

    /**
     * Answer a decoded message (the user chose it). Works for a CQ, or for a station that
     * is already calling me.
     * @param {{text: string, bits: string, snr: number|null}} decode
     * @param {{slotEven: boolean}} where decode.slot parity: I transmit in the other parity
     * @returns {boolean} false if the message can't be answered (e.g. not a standard message)
     */
    answer(decode, { slotEven }) {
        const p = parseMessageParts(decode.bits, decode.text);
        if (!p || !p.from?.text || p.from.hashed) return false;
        this.reset();
        this.dxCall = stripHash(p.from.text);
        this.txEven = !slotEven;
        this.sentReport = formatReport(decode.snr ?? -10);
        if (p.grid && (p.tail === 'grid' || p.kind === 'cq')) this.dxGrid = p.grid;
        if (this.isToMe(p)) {
            this.onDirected(p, decode);
            if (this.state === STATE.IDLE) { this.state = STATE.CALLING; this.nextKey = 'tx1'; }
        } else {
            this.state = STATE.CALLING;
            this.nextKey = 'tx1';
        }
        return true;
    }

    isToMe(p) {
        return p.to && stripHash(p.to.text) === this.myCall;
    }

    /**
     * New decodes from one slot. Returns true if the next message changed.
     * @param {Array<{text: string, bits: string, snr: number|null}>} decodes
     */
    onDecodes(decodes) {
        if (this.state === STATE.IDLE) return false;
        if (this.state === STATE.DONE && !this.dxCall) return false;
        const before = `${this.state}/${this.nextKey}/${this.dxCall}`;
        for (const d of decodes) {
            const p = parseMessageParts(d.bits, d.text);
            if (!p || !this.isToMe(p)) continue;
            const from = stripHash(p.from?.text);
            if (this.state === STATE.CQ && !this.dxCall) {
                // First station to answer my CQ.
                this.dxCall = from;
                this.sentReport = formatReport(d.snr ?? -10);
            }
            if (from !== this.dxCall) continue;
            this.onDirected(p, d);
        }
        return `${this.state}/${this.nextKey}/${this.dxCall}` !== before;
    }

    /** A message from the DX station to me. */
    onDirected(p, d) {
        this.repeats = 0;
        if (p.grid && p.tail === 'grid') this.dxGrid = p.grid;
        if (d?.snr != null && !this.sentReport) this.sentReport = formatReport(d.snr);
        switch (p.tail) {
            case 'grid':
            case 'none':
                // They called me (with or without a grid): send a report.
                this.state = STATE.REPORT_SENT;
                this.nextKey = 'tx2';
                break;
            case 'report':
                this.rcvdReport = p.report;
                this.state = STATE.ROGER_SENT;
                this.nextKey = 'tx3';
                break;
            case 'R-report':
                // Also when already done: they didn't hear my RR73, so send it again.
                this.rcvdReport = p.report;
                this.state = STATE.SIGNING_OFF;
                this.nextKey = 'tx4';
                break;
            case 'RRR':
            case 'RR73':
                // Also when already done: they didn't hear my 73, so send it again.
                if (this.state === STATE.ROGER_SENT || this.state === STATE.CALLING || this.state === STATE.DONE) {
                    this.state = STATE.SIGNING_OFF;
                    this.nextKey = 'tx5';
                }
                break;
            case '73':
                // They signed off. If I had sent my R+report or RR73 the QSO is complete.
                if (this.state === STATE.ROGER_SENT || this.state === STATE.SIGNING_OFF) this.complete();
                break;
        }
    }

    /** Call after each transmission, with what was sent. */
    afterTransmit(key) {
        if (key === 'tx4' || key === 'tx5') {
            this.complete();
            return;
        }
        this.repeats++;
        if (this.repeats >= this.maxRepeats) {
            this.state = STATE.IDLE;
            this.nextKey = null;
            this.gaveUp = true;
        }
    }

    complete() {
        if (this.state === STATE.DONE) return;
        this.state = STATE.DONE;
        this.nextKey = null;
        if (this.completed?.dxCall === this.dxCall) return; // a repeat of the sign-off: already logged
        this.completed = {
            dxCall: this.dxCall,
            dxGrid: this.dxGrid,
            sentReport: this.sentReport,
            rcvdReport: this.rcvdReport,
            time: Date.now(),
        };
    }
}
