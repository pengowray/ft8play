// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SlotClock, OFFSET_SOURCE } from '../../docs/qso/slot_clock.js';
import { MODES, txDurationSeconds } from '../../docs/qso/modes.js';

const at = (iso) => Date.parse(iso);

function fakeClock(startIso) {
    let t = at(startIso);
    const clock = new SlotClock({ now: () => t });
    return { clock, set: (iso) => { t = at(iso); }, advance: (ms) => { t += ms; } };
}

test('slots line up with UTC 15 s boundaries', () => {
    const { clock, set } = fakeClock('2026-10-14T12:00:07.250Z');
    assert.equal(clock.secondsIntoSlot(), 7.25);
    const index = clock.slotIndex();
    assert.equal(clock.slotStart(index), at('2026-10-14T12:00:00Z'));
    assert.ok(clock.isEvenSlot(index), ':00 is an even slot');

    set('2026-10-14T12:00:15.000Z');
    assert.equal(clock.secondsIntoSlot(), 0);
    assert.ok(!clock.isEvenSlot(clock.slotIndex()), ':15 is an odd slot');

    set('2026-10-14T12:00:44.999Z');
    assert.ok(clock.isEvenSlot(clock.slotIndex()), 'the slot from :30 to :45 is even');
});

test('even and odd follow seconds past the minute', () => {
    const { clock, set } = fakeClock('2026-10-14T12:00:00Z');
    for (const [sec, even] of [[0, true], [15, false], [30, true], [45, false]]) {
        set(`2026-10-14T12:01:${String(sec).padStart(2, '0')}.100Z`);
        assert.equal(clock.isEvenSlot(clock.slotIndex()), even, `${sec} s`);
    }
});

test('nextSlot gives the following boundary', () => {
    const { clock } = fakeClock('2026-10-14T12:00:59.900Z');
    const next = clock.nextSlot();
    assert.equal(next.start, at('2026-10-14T12:01:00Z'));
    assert.equal(next.index, clock.slotIndex() + 1);
});

test('manual offset shifts time and stops automatic correction', () => {
    const { clock } = fakeClock('2026-10-14T12:00:14.800Z');
    clock.setManualOffset(300);
    assert.equal(clock.offsetSource, OFFSET_SOURCE.MANUAL);
    assert.ok(Math.abs(clock.secondsIntoSlot() - 0.1) < 1e-9, 'now in the next slot');
    assert.equal(clock.toDeviceTime(clock.now()), at('2026-10-14T12:00:14.800Z'));
    assert.equal(clock.addSlotDts(1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), 0);
});

test('consistent positive DT moves the clock back', () => {
    const { clock } = fakeClock('2026-10-14T12:00:00Z');
    assert.equal(clock.addSlotDts(1, [0.4, 0.42]), 0, 'too few decodes');
    const c = clock.addSlotDts(2, [0.38, 0.4, 0.41, 0.39]);
    assert.ok(c < 0, 'offset decreases');
    assert.ok(Math.abs(c - (-0.4 * 1000 * 0.7)) < 15, `correction ${c}`);
    assert.equal(clock.offsetSource, OFFSET_SOURCE.DECODES);
});

test('small DT is ignored', () => {
    const { clock } = fakeClock('2026-10-14T12:00:00Z');
    assert.equal(clock.addSlotDts(1, [0.02, -0.03, 0.01, 0.04, 0.0, 0.03]), 0);
    assert.equal(clock.offsetMs, 0);
});

test('old slots drop out of the DT history', () => {
    const { clock } = fakeClock('2026-10-14T12:00:00Z');
    clock.addSlotDts(1, [0.5, 0.5]);
    clock.addSlotDts(2, [0.5, 0.5]);
    clock.addSlotDts(10, [0.5]); // slots 1 and 2 are too old now
    assert.equal(clock.offsetMs, 0);
});

test('FT8 timing numbers', () => {
    assert.ok(Math.abs(txDurationSeconds(MODES.FT8) - 12.64) < 1e-9);
    assert.ok(MODES.FT8.txStartSeconds + txDurationSeconds(MODES.FT8) < MODES.FT8.decodeAtSeconds);
});
