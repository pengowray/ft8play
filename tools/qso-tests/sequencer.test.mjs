// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sequencer, STATE, formatReport } from '../../docs/qso/sequencer.js';
import { PackJT77, fmtmsg, genft8Message } from '../../docs/wsjtx/packjt77.js';

// A decode as the receive pipeline gives it: text unpacked by the WSJT-X port, plus bits.
const packer = new PackJT77();
function decode(text, snr = -10) {
    const r = genft8Message(packer, fmtmsg(text.padEnd(37)));
    return { text: r.msgsent, bits: r.c77, snr };
}

test('formatReport', () => {
    assert.equal(formatReport(-7.4), '-07');
    assert.equal(formatReport(3), '+03');
    assert.equal(formatReport(-80), '-50');
    assert.equal(formatReport(60), '+49');
});

/** Runs two stations against each other; returns the transcript. */
function runQso(a, b, firstSender, { lose = () => false, maxSlots = 20 } = {}) {
    const transcript = [];
    let sender = firstSender;
    for (let slot = 0; slot < maxSlots; slot++) {
        const receiver = sender === a ? b : a;
        const next = sender.next;
        if (next) {
            transcript.push(`${sender.myCall}: ${next.text}`);
            sender.afterTransmit(next.key);
            if (!lose(slot, next.text)) receiver.onDecodes([decode(next.text, -12)]);
        }
        if (!a.next && !b.next) break;
        sender = receiver;
    }
    return transcript;
}

test('CQ, answer, reports, RR73, 73: both log the QSO', () => {
    const a = new Sequencer({ myCall: 'K1ABC', myGrid: 'FN42' });
    const b = new Sequencer({ myCall: 'W9XYZ', myGrid: 'EN37' });
    a.callCq({ even: true });
    // B hears the CQ and the user answers it.
    assert.ok(b.answer(decode('CQ K1ABC FN42', -15), { slotEven: true }));
    assert.equal(b.next.text, 'K1ABC W9XYZ EN37');
    const t = runQso(a, b, b);
    assert.deepEqual(t, [
        'W9XYZ: K1ABC W9XYZ EN37',
        'K1ABC: W9XYZ K1ABC -12',
        'W9XYZ: K1ABC W9XYZ R-15',
        'K1ABC: W9XYZ K1ABC RR73',
        'W9XYZ: K1ABC W9XYZ 73',
    ]);
    assert.equal(a.state, STATE.DONE);
    assert.equal(b.state, STATE.DONE);
    assert.deepEqual([a.completed.dxCall, a.completed.dxGrid, a.completed.sentReport, a.completed.rcvdReport], ['W9XYZ', 'EN37', '-12', '-15']);
    assert.deepEqual([b.completed.dxCall, b.completed.dxGrid, b.completed.sentReport, b.completed.rcvdReport], ['K1ABC', 'FN42', '-15', '-12']);
    assert.equal(b.txEven, false, 'answer in the opposite slot parity');
});

test('a lost RR73 is sent again when they repeat their R+report', () => {
    const a = new Sequencer({ myCall: 'K1ABC', myGrid: 'FN42' });
    const b = new Sequencer({ myCall: 'W9XYZ', myGrid: 'EN37' });
    a.callCq({ even: true });
    b.answer(decode('CQ K1ABC FN42', -15), { slotEven: true });
    let lost = false;
    const t = runQso(a, b, b, { lose: (slot, text) => (!lost && text.endsWith('RR73') ? (lost = true) : false) });
    assert.deepEqual(t, [
        'W9XYZ: K1ABC W9XYZ EN37',
        'K1ABC: W9XYZ K1ABC -12',
        'W9XYZ: K1ABC W9XYZ R-15',
        'K1ABC: W9XYZ K1ABC RR73',
        'W9XYZ: K1ABC W9XYZ R-15',
        'K1ABC: W9XYZ K1ABC RR73',
        'W9XYZ: K1ABC W9XYZ 73',
    ]);
    assert.equal(a.completed.dxCall, 'W9XYZ');
});

test('answering a station that calls me with a report goes straight to R+report', () => {
    const a = new Sequencer({ myCall: 'K1ABC', myGrid: 'FN42' });
    assert.ok(a.answer(decode('K1ABC W9XYZ -08', -3), { slotEven: false }));
    assert.equal(a.next.text, 'W9XYZ K1ABC R-03');
    assert.equal(a.txEven, true);
});

test('messages from other stations, or to other stations, are ignored', () => {
    const a = new Sequencer({ myCall: 'K1ABC', myGrid: 'FN42' });
    a.callCq({ even: true });
    a.onDecodes([decode('W9XYZ G4ABC -10'), decode('CQ PA9XYZ JO22')]);
    assert.equal(a.state, STATE.CQ);
    a.onDecodes([decode('K1ABC G4ABC IO91', -17)]);
    assert.equal(a.dxCall, 'G4ABC');
    assert.equal(a.next.text, 'G4ABC K1ABC -17');
    a.onDecodes([decode('K1ABC W9XYZ EN37')]); // someone else calls too: stay with G4ABC
    assert.equal(a.dxCall, 'G4ABC');
});

test('gives up after maxRepeats transmissions without a reply', () => {
    const a = new Sequencer({ myCall: 'K1ABC', myGrid: 'FN42', maxRepeats: 3 });
    a.callCq({ even: true });
    for (let i = 0; i < 3; i++) a.afterTransmit('tx6');
    assert.equal(a.next, null);
    assert.ok(a.gaveUp);
});
