// Transmit panel: QSO state, Call CQ / Answer / Stop, the six standard messages, transmit
// settings (frequency, even or odd slots, audio output, level), Halt TX and the
// "Transmitting" banner.

import { STATE } from '../sequencer.js';
import { PARTNER } from '../sources/test_signals.js';
import { parseMessageParts } from '../../ft8_parts.js';
import { $, store } from './dom.js';

const TX_FREQ_MIN_HZ = 200;
const TX_FREQ_MAX_HZ = 2950;

const STATE_TEXT = {
    [STATE.IDLE]: () => 'Not in a QSO',
    [STATE.CQ]: () => 'Calling CQ, waiting for a reply',
    [STATE.CALLING]: (s) => `Calling ${s.dxCall}, waiting for a report`,
    [STATE.REPORT_SENT]: (s) => `In QSO with ${s.dxCall} · report ${s.sentReport} sent, waiting for theirs`,
    [STATE.ROGER_SENT]: (s) => `In QSO with ${s.dxCall} · report ${s.rcvdReport} received`,
    [STATE.SIGNING_OFF]: (s) => `In QSO with ${s.dxCall} · signing off`,
    [STATE.DONE]: (s) => `QSO with ${s.dxCall} complete, added to the log`,
};

export class TransmitPanel {
    /**
     * @param {{clock: import('../slot_clock.js').SlotClock, transmitter: import('../tx.js').Transmitter,
     *          qso: import('../qso_controller.js').QsoController, radio: import('../radio/radio_control.js').RadioControl,
     *          testMode: () => boolean, waterfall: import('../waterfall.js').Waterfall,
     *          onError: (message: string) => void}} options
     */
    constructor({ clock, transmitter, qso, radio, testMode, waterfall, onError }) {
        Object.assign(this, { clock, transmitter, qso, radio, testMode, waterfall, onError });
        this.selectedDecode = null;
        this.setUpSettings();
        this.setUpButtons();
        qso.addEventListener('change', () => this.render());
        radio.addEventListener('change', () => this.renderHelp());
    }

    setUpSettings() {
        const { transmitter, qso } = this;
        const txFreq = $('tx-freq');
        txFreq.value = store.get('txFreq', '1500');
        const applyTxFreq = () => {
            const hz = Math.max(TX_FREQ_MIN_HZ, Math.min(TX_FREQ_MAX_HZ, Math.round(Number(txFreq.value) || 1500)));
            txFreq.value = hz;
            store.set('txFreq', hz);
            qso.txFreqHz = hz;
            this.waterfall.setTxFreq(hz);
        };
        txFreq.addEventListener('change', applyTxFreq);
        applyTxFreq();

        $('tx-level').value = store.get('txLevel', '0.5');
        transmitter.setLevel(Number($('tx-level').value));
        $('tx-level').addEventListener('input', (e) => { transmitter.setLevel(Number(e.target.value)); store.set('txLevel', e.target.value); });

        $('tx-parity').value = store.get('txParity', 'even');
        $('tx-parity').addEventListener('change', (e) => {
            store.set('txParity', e.target.value);
            if (qso.seq) qso.seq.txEven = e.target.value === 'even';
            this.render();
        });

        $('tx-output').addEventListener('change', async (e) => {
            store.set('txOutput', e.target.value);
            try {
                await transmitter.setOutputDevice(e.target.value);
            } catch (err) {
                this.onError(`Could not use audio output "${e.target.selectedOptions[0]?.textContent}": ${err.message}`);
            }
        });
        transmitter.outputDeviceId = store.get('txOutput');
        this.fillOutputList();
    }

    async fillOutputList() {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput' && d.deviceId !== 'default');
        const select = $('tx-output');
        const saved = store.get('txOutput');
        select.replaceChildren(new Option('Default output', ''), ...outputs.map((d, i) => new Option(d.label || `Output ${i + 1}`, d.deviceId, false, d.deviceId === saved)));
        if (!('setSinkId' in AudioContext.prototype)) select.disabled = true;
    }

    setUpButtons() {
        const { transmitter, qso } = this;
        $('tx-enable').addEventListener('change', async (e) => {
            if (e.target.checked && !qso.blocker() && !this.testMode()) {
                try {
                    await transmitter.ensureAudio();
                } catch (err) {
                    this.onError(`Audio output failed, transmit not enabled: ${err.message}`);
                    e.target.checked = false;
                }
            }
            qso.setEnabled(e.target.checked);
            e.target.checked = qso.enabled;
            this.render();
        });
        $('call-cq').addEventListener('click', () => qso.callCq({ even: $('tx-parity').value === 'even' }));
        $('answer').addEventListener('click', () => this.answerSelected());
        $('stop-qso').addEventListener('click', () => qso.stopQso());
        const halt = () => { qso.halt(); $('tx-enable').checked = false; };
        document.querySelectorAll('[data-halt]').forEach((b) => b.addEventListener('click', halt));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && (transmitter.current || qso.enabled)) halt();
        });
    }

    /** A decoded message chosen in Band activity (null to clear). */
    select(decode) {
        this.selectedDecode = decode;
        this.render();
    }

    answerSelected() {
        const d = this.selectedDecode;
        if (!d) return;
        if (!this.qso.answer(d)) this.onError(`Can't answer "${d.text}": the sender's full callsign isn't in the message.`);
    }

    render() {
        const { qso, transmitter } = this;
        const seq = qso.seq;
        let state = STATE_TEXT[qso.state](seq ?? {});
        if (seq?.gaveUp) state = seq.dxCall ? `No reply from ${seq.dxCall}; stopped calling` : 'No reply to CQ; stopped calling';
        if (qso.next && !qso.enabled) {
            // Nothing is being sent, so don't say "calling".
            if (qso.state === STATE.CQ) state = 'CQ ready to send';
            if (qso.state === STATE.CALLING) state = `Call to ${seq.dxCall} ready to send`;
            state += ' · Enable transmit is off';
        }
        $('qso-state').textContent = state;

        const blocker = qso.blocker();
        $('tx-blocker').textContent = blocker ?? (qso.enabled || !qso.next ? '' : 'Tick Enable transmit to send the next message.');
        $('tx-enable').checked = qso.enabled;
        $('call-cq').disabled = !!blocker;
        const answer = $('answer');
        const d = this.selectedDecode;
        const dx = d ? parseMessageParts(d.bits, d.text)?.from?.text : null;
        answer.hidden = !d;
        answer.textContent = dx ? `Answer ${dx.replace(/[<>]/g, '')}` : 'Answer';
        answer.disabled = !!blocker;
        $('stop-qso').hidden = !seq || qso.state === STATE.IDLE || qso.state === STATE.DONE;
        $('stop-qso').textContent = qso.state === STATE.CQ ? 'Stop CQ' : 'Stop QSO';
        if (seq?.txEven != null) $('tx-parity').value = seq.txEven ? 'even' : 'odd';

        // The six messages, with the next one marked. Click one to send it next.
        const list = $('tx-messages');
        const msgs = seq?.messages() ?? null;
        list.hidden = !msgs;
        if (msgs) {
            const next = qso.next?.key;
            const sending = transmitter.current?.key;
            list.replaceChildren(...['tx1', 'tx2', 'tx3', 'tx4', 'tx5', 'tx6'].map((key) => {
                const li = document.createElement('li');
                li.className = [key === next ? 'next' : '', key === sending ? 'sending' : ''].join(' ').trim();
                li.innerHTML = `<span class="tx-key">${key.replace('tx', 'Tx')}</span><span></span>`;
                li.lastChild.textContent = msgs[key];
                li.title = 'Send this message next';
                li.addEventListener('click', () => qso.choose(key));
                return li;
            }));
        }
        this.renderHelp();
        this.renderBanner();
    }

    renderHelp() {
        $('tx-help').textContent = this.testMode()
            ? `Test mode: no audio is played and the radio is not keyed. The simulated station ${PARTNER.call} receives your messages, calls CQ, and answers your CQ.`
            : `Transmit audio goes to the audio output chosen above. PTT: ${this.radio.pttDescription}. Transmitting needs an amateur radio licence.`;
    }

    /** The "Transmitting" banner at the top of the page; called about 10 times a second. */
    renderBanner() {
        const tx = this.transmitter.current;
        const now = this.clock.now();
        const on = tx && now >= tx.slotStart;
        $('tx-banner').hidden = !on;
        if (on) {
            const left = Math.max(0, (tx.audioEnd - now) / 1000);
            $('tx-banner-text').textContent = `${tx.sent} · ${tx.freqHz} Hz · ${left.toFixed(0)} s left`;
        }
    }
}
