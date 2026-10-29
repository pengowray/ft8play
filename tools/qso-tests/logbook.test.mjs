// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LogBook } from '../../docs/qso/logbook.js';
import { adifRecord, toAdif } from '../../docs/qso/adif.js';
import { adifBand, bandName } from '../../docs/qso/bands.js';

/** Enough of the Storage interface for LogBook. */
function memoryStorage() {
    const items = new Map();
    return {
        getItem: (k) => items.has(k) ? items.get(k) : null,
        setItem: (k, v) => items.set(k, String(v)),
        removeItem: (k) => items.delete(k),
    };
}

const qso = (overrides = {}) => ({
    startTime: Date.parse('2026-10-29T07:12:15Z'),
    endTime: Date.parse('2026-10-29T07:13:30Z'),
    dxCall: 'W9XYZ', dxGrid: 'EN37', sentReport: '-11', rcvdReport: '-07',
    myCall: 'K1ABC', myGrid: 'FN42', dialHz: 14074000, txFreqHz: 1500, mode: 'FT8',
    ...overrides,
});

test('bands from frequencies', () => {
    assert.equal(adifBand(14075500), '20m');
    assert.equal(adifBand(7074000), '40m');
    assert.equal(adifBand(144174000), '2m');
    assert.equal(adifBand(15000000), null);
    assert.equal(bandName(28074000), '10 m');
    assert.equal(bandName(null), null);
});

test('ADIF record has the fields logging programs need', () => {
    const r = adifRecord(qso());
    for (const f of ['<CALL:5>W9XYZ', '<GRIDSQUARE:4>EN37', '<MODE:3>FT8', '<RST_SENT:3>-11', '<RST_RCVD:3>-07',
        '<QSO_DATE:8>20261029', '<TIME_ON:6>071215', '<QSO_DATE_OFF:8>20261029', '<TIME_OFF:6>071330',
        '<BAND:3>20m', '<FREQ:9>14.075500', '<STATION_CALLSIGN:5>K1ABC', '<MY_GRIDSQUARE:4>FN42']) {
        assert.ok(r.includes(f), `${f} in ${r}`);
    }
    assert.ok(r.endsWith('<EOR>'));
});

test('ADIF record without a dial frequency or grid leaves those fields out', () => {
    const r = adifRecord(qso({ dialHz: null, dxGrid: null }));
    assert.ok(!/BAND|FREQ|GRIDSQUARE:/.test(r.replace('MY_GRIDSQUARE', '')), r);
    assert.ok(r.includes('<CALL:5>W9XYZ'));
});

test('ADIF file has a header', () => {
    const text = toAdif([qso(), qso({ dxCall: 'G4ABC' })], { now: Date.parse('2026-10-29T08:00:00Z') });
    const [header, body] = text.split('<EOH>');
    const records = body.trim().split('\n');
    assert.ok(!header.startsWith('<'), 'header text must not start with <');
    assert.ok(header.includes('<ADIF_VER:5>3.1.4'));
    assert.ok(header.includes('<CREATED_TIMESTAMP:15>20261029 080000'));
    assert.equal(records.length, 2);
});

test('log is saved, test-mode QSOs are not', () => {
    const storage = memoryStorage();
    const a = new LogBook({ storage });
    a.add(qso());
    a.add(qso({ dxCall: 'WA9XYZ', test: true, endTime: Date.parse('2026-10-29T07:20:00Z') }));
    assert.deepEqual(a.entries.map(e => e.dxCall), ['WA9XYZ', 'W9XYZ'], 'newest first, test included');

    const b = new LogBook({ storage });
    assert.deepEqual(b.entries.map(e => e.dxCall), ['W9XYZ'], 'after a reload');
    assert.ok(!a.toAdif().includes('WA9XYZ'), 'test-mode QSOs are not exported');
});

test('a QSO logged in another tab is kept', () => {
    const storage = memoryStorage();
    const tab1 = new LogBook({ storage });
    const tab2 = new LogBook({ storage });
    tab1.add(qso({ dxCall: 'G4ABC' }));
    tab2.add(qso({ dxCall: 'VK2XYZ' }));
    assert.deepEqual(new LogBook({ storage }).entries.map(e => e.dxCall).sort(), ['G4ABC', 'VK2XYZ']);
});

test('clear deletes the saved log; a failed save is reported', () => {
    const storage = memoryStorage();
    const log = new LogBook({ storage });
    log.add(qso());
    log.clear();
    assert.equal(new LogBook({ storage }).entries.length, 0);

    const full = { ...memoryStorage(), setItem: () => { throw new Error('QuotaExceededError'); } };
    const log2 = new LogBook({ storage: full });
    log2.add(qso());
    assert.equal(log2.saveError, 'QuotaExceededError');
    assert.equal(log2.entries.length, 1, 'still shown');
});
