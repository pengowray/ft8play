// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dial } from '../../docs/qso/dial.js';

function memoryStorage(initial = {}) {
    const items = new Map(Object.entries(initial));
    return { getItem: (k) => items.has(k) ? items.get(k) : null, setItem: (k, v) => items.set(k, String(v)), removeItem: (k) => items.delete(k) };
}

test('the dial starts unset, and remembers the user\'s choice but not the radio\'s', () => {
    const storage = memoryStorage();
    assert.equal(new Dial({ storage }).hz, null);
    const dial = new Dial({ storage });
    dial.set('7074000');
    assert.equal(new Dial({ storage }).hz, 7074000);
    dial.fromRadio(14074000);
    assert.equal(dial.hz, 14074000);
    assert.equal(new Dial({ storage }).hz, 7074000, 'a frequency read from the radio is not saved');
});

test('change events say who changed the dial; repeated radio readings are ignored', () => {
    const dial = new Dial({ storage: memoryStorage() });
    const events = [];
    dial.addEventListener('change', (e) => events.push(e.detail));
    dial.set(14074000);
    dial.fromRadio(14074000);  // same as the dial: no event
    dial.fromRadio(14074500);
    dial.fromRadio(14074500);  // the next poll: no event
    dial.fromRadio(null);      // no frequency read: ignored
    dial.set(14074500);        // the user picks the same frequency: still an event, so the radio is set
    assert.deepEqual(events, [
        { hz: 14074000, from: 'user' },
        { hz: 14074500, from: 'radio' },
        { hz: 14074500, from: 'user' },
    ]);
});

test('the sound card dial saved by the previous version is used once', () => {
    assert.equal(new Dial({ storage: memoryStorage({ 'qso.soundcardDial': '21074000' }) }).hz, 21074000);
});
