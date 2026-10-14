// Runs QSOs: feeds decodes to the sequencer and books the sequencer's next message on the
// transmitter, in the right slots, while transmitting is enabled. No DOM.
//
// Safety rules:
//   - nothing is transmitted unless enabled() is true (the page asks the user every session)
//   - nothing starts by itself: a QSO starts only when the user calls CQ or answers a decode
//   - halt() stops the current transmission at once and turns transmitting off
//
// Events (CustomEvent): 'change' (state, next message or transmitting changed),
// 'logged' (detail: a completed QSO).

import { Sequencer, STATE } from './sequencer.js';

// A message decided up to this long after its slot began is still sent in that slot (as
// WSJT-X does when the decodes arrive late); later than that, it waits for the next slot.
const LATE_START_SECONDS = 1.5;

export class QsoController extends EventTarget {
    /**
     * @param {{clock: object, transmitter: import('./tx.js').Transmitter}} options
     */
    constructor({ clock, transmitter }) {
        super();
        this.clock = clock;
        this.tx = transmitter;
        this.myCall = '';
        this.myGrid = '';
        this.txFreqHz = 1500;
        this.enabled = false;
        this.seq = null;
        this.override = null;     // { key, text } chosen by the user instead of the sequencer's next
        this.booked = null;       // slot index of a booked transmission
        this.log = [];
        this.lastError = '';

        this.tx.addEventListener('done', (e) => this.onTxDone(e.detail));
        for (const type of ['scheduled', 'ptton', 'audiostart', 'pttoff']) this.tx.addEventListener(type, () => this.changed());
    }

    setStation(myCall, myGrid) {
        this.myCall = (myCall || '').trim().toUpperCase();
        this.myGrid = (myGrid || '').trim().toUpperCase();
        if (this.seq && this.seq.myCall !== this.myCall) this.stopQso();
        this.changed();
    }

    /** Why transmitting can't be enabled, or null if it can. */
    blocker() {
        if (!this.myCall) return 'Enter your callsign under My station.';
        if (!/^[A-R]{2}\d{2}$/.test(this.myGrid)) return 'Enter your 4-character grid square under My station.';
        return null;
    }

    setEnabled(on) {
        this.enabled = on && !this.blocker();
        if (!this.enabled) this.tx.halt();
        this.changed();
        if (this.enabled) this.maybeBook();
    }

    get state() { return this.seq?.state ?? STATE.IDLE; }
    get transmitting() { return this.tx.current; }

    /** The message that will be sent next. */
    get next() {
        return this.override ?? this.seq?.next ?? null;
    }

    newSequencer() {
        this.seq = new Sequencer({ myCall: this.myCall, myGrid: this.myGrid });
        this.override = null;
        return this.seq;
    }

    callCq({ even }) {
        if (this.blocker()) return false;
        this.newSequencer().callCq({ even });
        this.changed();
        this.maybeBook();
        return true;
    }

    /** Answer a decode the user picked. */
    answer(decode) {
        if (this.blocker()) return false;
        const ok = this.newSequencer().answer(decode, { slotEven: this.clock.isEvenSlot(decode.slot) });
        if (!ok) this.seq = null;
        this.changed();
        this.maybeBook();
        return ok;
    }

    /** Send one of the standard messages next instead of the sequencer's choice. */
    choose(key) {
        if (!this.seq) return;
        this.override = { key, text: this.seq.messages()[key] };
        this.rebookIfChanged();
        this.changed();
        this.maybeBook();
    }

    stopQso() {
        this.tx.halt();
        this.seq = null;
        this.override = null;
        this.changed();
    }

    /** Stop transmitting now, and turn transmitting off (like WSJT-X's Halt Tx). */
    halt() {
        this.tx.halt();
        this.enabled = false;
        this.changed();
    }

    /** Decodes of one slot, from the receive pipeline. */
    onDecodes(result) {
        if (!this.seq || typeof result.slot !== 'number') return;
        const decodes = result.decodes.map(d => ({ ...d, slot: result.slot }));
        // Ignore my own transmissions heard back.
        if (this.seq.onDecodes(decodes.filter(d => !d.text.split(' ').slice(1, 2).includes(this.myCall)))) {
            this.override = null;
        }
        this.log.push(...this.takeCompleted());
        this.rebookIfChanged();
        this.changed();
        this.maybeBook();
    }

    /** If a booked transmission hasn't started and the next message changed, replace it. */
    rebookIfChanged() {
        const tx = this.tx.current;
        if (!tx || this.clock.now() >= tx.slotStart) return;
        const next = this.next;
        if (!next || next.text !== tx.text || !this.enabled) this.tx.halt();
    }

    takeCompleted() {
        const c = this.seq?.completed;
        if (!c || c.loggedByController) return [];
        c.loggedByController = true;
        this.dispatchEvent(new CustomEvent('logged', { detail: c }));
        return [c];
    }

    /** Books the next message in the next slot of the right parity, if one is due. */
    async maybeBook() {
        if (!this.enabled || !this.seq || this.tx.current) return;
        const next = this.next;
        if (!next) return;
        const now = this.clock.now();
        const current = this.clock.slotIndex(now);
        let slot;
        if (this.clock.isEvenSlot(current) === this.seq.txEven && this.clock.secondsIntoSlot(now) < LATE_START_SECONDS) {
            slot = current; // late start in the slot that has just begun
        } else {
            slot = current + 1;
            // Book only for the very next slot, so a decision can still change before then.
            if (this.clock.isEvenSlot(slot) !== this.seq.txEven) return;
        }
        if (this.booked === slot) return;
        try {
            const prepared = this.tx.prepare(next.text);
            this.booked = slot;
            await this.tx.schedule({ ...prepared, key: next.key }, { slot, freqHz: this.txFreqHz });
        } catch (err) {
            this.lastError = err.message;
            this.changed();
        }
    }

    onTxDone(tx) {
        this.booked = null;
        if (tx.halted && this.enabled) {
            // Cancelled before it started (the next message changed): book the new one.
            this.changed();
            this.maybeBook();
            return;
        }
        if (!tx.halted && this.seq) {
            this.seq.afterTransmit(tx.key);
            this.override = null;
            this.log.push(...this.takeCompleted());
        }
        this.changed();
    }

    /**
     * Call regularly (e.g. every 100 ms). Normally the decodes (at 14.4 s) book the next
     * transmission; this books it near the end of the slot if no decodes arrive (e.g. when
     * receiving is stopped).
     */
    tick() {
        const into = this.clock.secondsIntoSlot();
        if (into > this.clock.mode.decodeAtSeconds + 0.25) this.maybeBook();
    }

    changed() {
        this.dispatchEvent(new CustomEvent('change'));
    }
}
