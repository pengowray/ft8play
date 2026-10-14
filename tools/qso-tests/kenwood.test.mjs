// node --test "tools/qso-tests/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SerialLink } from '../../docs/qso/radio/serial_link.js';
import { KenwoodRadio, MODE } from '../../docs/qso/radio/kenwood.js';
import { FakeKenwoodPort } from '../../docs/qso/radio/fake_kenwood.js';

test('Kenwood CAT with a QMX-like radio: identify, status, tune, mode, PTT', async () => {
    const port = new FakeKenwoodPort({ model: 'QMX', frequency: 7074000 });
    const radio = new KenwoodRadio(new SerialLink(port));
    assert.equal(await radio.connect(), 'QRP Labs QMX');
    assert.equal(radio.frequency, 7074000);
    assert.equal(radio.mode, MODE.USB);
    assert.equal(radio.transmitting, false);

    assert.equal(await radio.setFrequency(14074000), 14074000);
    await radio.setMode(MODE.FSK);
    await radio.ptt(true);
    assert.equal((await radio.readStatus()).transmitting, true);
    await radio.ptt(false);
    const status = await radio.readStatus();
    assert.deepEqual(status, { frequency: 14074000, mode: MODE.FSK, transmitting: false });
    assert.ok(port.log.includes('FA00014074000;'));
    assert.ok(port.log.every(c => !c.includes('\r') && !c.includes('\n')), 'never sends CR or LF');
    await radio.close();
});

test('a radio that does not answer OM is still usable', async () => {
    const port = new FakeKenwoodPort({ model: 'truSDX' });
    const radio = new KenwoodRadio(new SerialLink(port));
    assert.equal(await radio.connect(), 'Kenwood TS-480 compatible');
    await radio.close();
});

test('no reply gives a clear error', async () => {
    const port = new FakeKenwoodPort();
    port.handle = () => null; // silent radio
    const link = new SerialLink(port);
    await assert.rejects(new KenwoodRadio(link).connect(), /No reply to ID;/);
    await link.close();
});
