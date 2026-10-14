// FT8 QSO page: receive side. Wires the slot clock, audio sources, decoder pipeline,
// waterfall and band activity together.

import { SlotClock, OFFSET_SOURCE } from './slot_clock.js';
import { RxPipeline } from './rx_pipeline.js';
import { Waterfall } from './waterfall.js';
import { BandActivity, utcTime } from './band_activity.js';
import { TestSignalSource } from './sources/test_signals.js';
import { SoundCardSource, listInputDevices } from './sources/sound_card.js';
import { readAudioFile } from './sources/wav_file.js';
import { RtlSdrSource, FT8_DIAL_FREQUENCIES } from './sources/rtlsdr.js';
import { FakeRtlProvider } from './sources/fake_rtlsdr.js';
import { Transmitter } from './tx.js';
import { QsoController } from './qso_controller.js';
import { STATE } from './sequencer.js';
import { PARTNER } from './sources/test_signals.js';
import { parseMessageParts } from '../ft8_parts.js';
import { RadioControl } from './radio/radio_control.js';

// ?fake-rtlsdr replaces the RTL-SDR with a simulated one (for testing without hardware).
const fakeRtl = new URLSearchParams(location.search).has('fake-rtlsdr');

const $ = (id) => document.getElementById(id);
const store = {
    get(key, fallback = '') { try { return localStorage.getItem(`qso.${key}`) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(`qso.${key}`, value); } catch { /* storage unavailable */ } },
};

const clock = new SlotClock();
const pipeline = new RxPipeline({ clock });
const waterfall = new Waterfall(document.querySelector('.waterfall'));
const transmitter = new Transmitter({ clock });
const qso = new QsoController({ clock, transmitter });
let selectedDecode = null;
const bandActivity = new BandActivity(document.querySelector('.band-activity'), {
    onHover: (d) => waterfall.showSignal(d ? d.freqHz : null),
    onSelect: (d) => { selectedDecode = d; renderQso(); },
    onPick: (d) => { selectedDecode = d; answerSelected(); },
});

let source = null;       // running live source
let sourceKind = null;   // 'soundcard' | 'test' while running
let lastError = '';
let pendingFile = null;  // { label, seconds } while an audio file is being decoded

// ---- My station ----
const myCallInput = $('my-call');
const myGridInput = $('my-grid');
myCallInput.value = store.get('myCall');
myGridInput.value = store.get('myGrid');
function applyMyCall() {
    const call = myCallInput.value.trim().toUpperCase();
    const grid = myGridInput.value.trim().toUpperCase();
    store.set('myCall', call);
    store.set('myGrid', grid);
    pipeline.setMyCall(call);
    bandActivity.setMyCall(call);
    qso.setStation(call, grid);
}
myCallInput.addEventListener('change', applyMyCall);
myGridInput.addEventListener('change', applyMyCall);
applyMyCall();
if (!myCallInput.value) document.querySelector('.station').open = true;

// ---- Pipeline events ----
pipeline.addEventListener('ready', (e) => waterfall.setGeometry(e.detail));
pipeline.addEventListener('slot', (e) => {
    const { slot, start, label } = e.detail;
    waterfall.markSlot(start != null ? utcTime(start) : label, slot);
});
pipeline.addEventListener('row', (e) => waterfall.addRow(e.detail.row, e.detail.time));
pipeline.addEventListener('decodes', (e) => {
    const result = e.detail;
    bandActivity.addSlot(result);
    waterfall.addDecodes(result.slot, result.decodes);
    qso.onDecodes(result);
    if (pendingFile && result.label === pendingFile.label) {
        const { label, seconds } = pendingFile;
        pendingFile = null;
        setState(seconds > clock.mode.slotSeconds + 1
            ? `Decoded the first 15 s of ${label} (${seconds.toFixed(0)} s long)`
            : `Decoded ${label}`);
    }
    // Correct the clock from received signals, but not from simulated ones.
    const realSignals = sourceKind === 'soundcard' || (sourceKind === 'rtlsdr' && !fakeRtl);
    if (realSignals && typeof result.slot === 'number') {
        clock.addSlotDts(result.slot, result.decodes.filter(d => d.snr == null || d.snr > -18).map(d => d.dt));
    }
});
pipeline.addEventListener('error', (e) => showError(`Decoder error: ${e.detail.message}`));

// ---- Source selection ----
const help = {
    soundcard: 'Receives audio from a sound card input, such as a radio\'s USB audio. Set the radio to upper sideband (USB) on an FT8 frequency, for example 14.074 MHz. The browser will ask for microphone permission.',
    rtlsdr: 'Receives with an RTL-SDR USB stick (RTL-SDR Blog V3 or V4, or another R820T/R828D stick) and an antenna, in upper sideband on the chosen FT8 frequency. Works in Chrome and Edge, including on Android. The browser asks which USB device to use.',
    test: 'Simulated FT8 signals mixed with noise, for trying the page without a radio.',
    file: 'Decodes the first 15 s of a recording. The recording must start at the beginning of a slot (:00, :15, :30 or :45 past the minute), such as a WAV file saved by WSJT-X.',
};
function selectedSource() {
    return document.querySelector('input[name="source"]:checked').value;
}
document.querySelectorAll('input[name="source"]').forEach((r) => r.addEventListener('change', async () => {
    await stopSource();
    store.set('source', selectedSource());
    updateControls();
}));
const savedSource = store.get('source', 'test');
const savedRadio = document.querySelector(`input[name="source"][value="${savedSource}"]`);
if (savedRadio) savedRadio.checked = true;

async function fillDeviceList() {
    const select = $('input-device');
    const devices = await listInputDevices();
    const saved = store.get('inputDevice');
    select.replaceChildren(...devices.map((d, i) => {
        const o = document.createElement('option');
        o.value = d.deviceId;
        o.textContent = d.label || (i === 0 ? 'Default input' : `Input ${i + 1}`);
        if (d.deviceId === saved) o.selected = true;
        return o;
    }));
}
// RTL-SDR band and gain.
const bandSelect = $('rtl-band');
bandSelect.replaceChildren(...FT8_DIAL_FREQUENCIES.map(({ band, hz }) => {
    const o = document.createElement('option');
    o.value = hz;
    o.textContent = `${band} · ${(hz / 1e6).toFixed(3)} MHz`;
    return o;
}));
bandSelect.value = store.get('rtlDial', '14074000');
bandSelect.addEventListener('change', async () => {
    store.set('rtlDial', bandSelect.value);
    if (sourceKind === 'rtlsdr') {
        await source.setDial(Number(bandSelect.value));
        updateControls();
    }
});
const gainSelect = $('rtl-gain');
gainSelect.replaceChildren(...['auto', 0, 10, 20, 30, 40, 49].map((g) => {
    const o = document.createElement('option');
    o.value = g;
    o.textContent = g === 'auto' ? 'Gain: automatic' : `Gain: ${g} dB`;
    return o;
}));
gainSelect.value = store.get('rtlGain', 'auto');
const selectedGain = () => (gainSelect.value === 'auto' ? null : Number(gainSelect.value));
gainSelect.addEventListener('change', async () => {
    store.set('rtlGain', gainSelect.value);
    if (sourceKind === 'rtlsdr') await source.setGain(selectedGain());
});
if (!navigator.usb && !fakeRtl) {
    const radio = document.querySelector('input[name="source"][value="rtlsdr"]');
    radio.disabled = true;
    radio.parentElement.title = 'Needs WebUSB, which this browser doesn\'t have. Use Chrome or Edge.';
    radio.parentElement.classList.add('unavailable');
}

$('input-device').addEventListener('change', async (e) => {
    store.set('inputDevice', e.target.value);
    if (sourceKind === 'soundcard') { await stopSource(); await startSource(); }
});

$('rx-toggle').addEventListener('click', async () => {
    const kind = selectedSource();
    if (kind === 'file') { $('file-input').click(); return; }
    if (source) await stopSource(); else await startSource();
});

$('file-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    lastError = '';
    setState(`Decoding ${file.name}…`);
    try {
        await pipeline.start();
        const { samples, seconds } = await readAudioFile(file, clock.mode.sampleRate);
        // Show the recording on the waterfall, one row per block, by feeding it like live audio.
        // The status changes to "Decoded" when the decoder's results arrive (see the 'decodes' handler).
        pendingFile = { label: file.name, seconds };
        pipeline.decodeRecording(samples, file.name);
    } catch (err) {
        showError(`Could not read ${file.name}: ${err.message}`);
    }
});

async function startSource() {
    lastError = '';
    const kind = selectedSource();
    try {
        await pipeline.start();
        const onAudio = (samples, startTime) => pipeline.pushAudio(samples, startTime);
        if (kind === 'test') {
            source = new TestSignalSource({ clock, onAudio });
            source.start();
        } else if (kind === 'rtlsdr') {
            source = new RtlSdrSource({
                clock, onAudio, dialHz: Number(bandSelect.value), gainDb: selectedGain(),
                provider: fakeRtl ? new FakeRtlProvider({ clock }) : undefined,
            });
            source.onError = (err) => { showError(`RTL-SDR stopped: ${err.message}`); stopSource(); };
            await source.start();
        } else if (kind === 'soundcard') {
            source = new SoundCardSource({ clock, onAudio, deviceId: store.get('inputDevice') || null });
            await source.start();
            await fillDeviceList(); // labels are only available after permission is granted
        }
        sourceKind = kind;
    } catch (err) {
        source = null;
        sourceKind = null;
        let message = `Could not start receiving: ${err.message}`;
        if (kind === 'soundcard' && err.name === 'NotAllowedError') {
            message = 'Microphone permission was refused. Allow it in the browser\'s site settings, then try again.';
        } else if (kind === 'rtlsdr' && err.name === 'NotFoundError') {
            message = 'No RTL-SDR was chosen. Plug it in, press Start receiving, and pick it in the list.';
        } else if (kind === 'rtlsdr' && /claim|access|busy|SecurityError/i.test(`${err.name} ${err.message}`)) {
            message = `Could not open the RTL-SDR: ${err.message}. Another program may be using it; on Linux, its TV driver (dvb_usb_rtl28xxu) may need unloading.`;
        }
        showError(message);
    }
    updateControls();
}

async function stopSource() {
    if (!source) return;
    await source.stop();
    source = null;
    sourceKind = null;
    pipeline.flush();
    updateControls();
}

function showError(message) {
    lastError = message;
    updateControls();
}

function setState(text, cls = '') {
    const el = $('rx-state');
    el.textContent = text;
    el.className = `rx-state ${cls}`;
}

// ---- Radio control ----
// ?fake-radio uses a simulated QMX on a pretend serial port.
const radio = new RadioControl({ fake: new URLSearchParams(location.search).has('fake-radio') });
const radioMethod = $('radio-method');
radioMethod.value = store.get('radioMethod', 'vox');
$('radio-baud').value = store.get('radioBaud', '115200');
$('radio-band').replaceChildren(new Option('Choose a band', ''), ...FT8_DIAL_FREQUENCIES.map(({ band, hz }) => new Option(`${band} · ${(hz / 1e6).toFixed(3)} MHz`, hz)));
radioMethod.addEventListener('change', () => { store.set('radioMethod', radioMethod.value); renderRadio(); });
$('radio-baud').addEventListener('change', (e) => store.set('radioBaud', e.target.value));
$('radio-connect').addEventListener('click', async () => {
    try {
        await radio.connect(radioMethod.value, { baudRate: Number($('radio-baud').value) });
    } catch (err) {
        showError(`Radio: ${err.message}`);
    }
});
$('radio-disconnect').addEventListener('click', () => radio.disconnect());
$('radio-band').addEventListener('change', async (e) => {
    if (!e.target.value) return;
    try { await radio.setFrequency(Number(e.target.value)); } catch (err) { showError(`Radio: ${err.message}`); }
});
radio.addEventListener('change', renderRadio);
setInterval(() => radio.refresh(), 2000);

function renderRadio() {
    const method = radioMethod.value;
    const usesPort = method !== 'vox';
    const connected = !!radio.link;
    $('radio-connect').hidden = !usesPort || connected;
    $('radio-connect').disabled = !RadioControl.available && !radio.fake;
    $('radio-disconnect').hidden = !connected;
    $('radio-baud').parentElement.hidden = !usesPort;
    $('radio-cat-fields').hidden = !(connected && radio.radio);
    const f = radio.frequency;
    $('radio-freq').textContent = f ? `Dial ${(f / 1e6).toFixed(6)} MHz` : '';
    if (f) $('radio-band').value = FT8_DIAL_FREQUENCIES.some(b => b.hz === f) ? f : '';
    $('radio-summary').textContent = method === 'vox' ? 'none (VOX)'
        : connected ? `${radio.label}${f ? ` · ${(f / 1e6).toFixed(3)} MHz` : ''}`
        : 'not connected';
    let help = '';
    if (!RadioControl.available && !radio.fake && usesPort) help = 'This browser has no Web Serial. Use Chrome or Edge on a computer (or Chrome 148 or later on Android).';
    else if (method === 'vox') help = 'The page plays the transmit audio; the radio must switch to transmit by itself. A QMX in Digi mode does this from USB audio.';
    else if (method === 'cat') help = 'Pick the radio\'s serial port (a QMX shows up to three; use the first). The page sets the radio to Digi mode (QMX) or USB, keys it with TX; and RX;, and can change its frequency.';
    else help = `Keys PTT by turning on the serial port's ${method.toUpperCase()} line while transmitting.`;
    $('radio-help').textContent = radio.error ? `${radio.error} ${help}` : help;
}
renderRadio();

// PTT follows the transmitter. If the radio can't be reached, stop transmitting.
transmitter.addEventListener('ptton', async () => {
    try { await radio.ptt(true); } catch (err) { qso.halt(); showError(`PTT failed, transmit stopped: ${err.message}`); }
});
transmitter.addEventListener('pttoff', async () => {
    try { await radio.ptt(false); } catch (err) { showError(`Could not unkey the radio: ${err.message}. Check the radio.`); }
});

// ---- Transmit ----
transmitter.addLoopback((tx) => { if (sourceKind === 'test') source.hear(tx); });

const txFreqInput = $('tx-freq');
txFreqInput.value = store.get('txFreq', '1500');
function applyTxFreq() {
    const hz = Math.max(200, Math.min(2950, Math.round(Number(txFreqInput.value) || 1500)));
    txFreqInput.value = hz;
    store.set('txFreq', hz);
    qso.txFreqHz = hz;
    waterfall.setTxFreq(hz);
}
txFreqInput.addEventListener('change', applyTxFreq);
applyTxFreq();

$('tx-level').value = store.get('txLevel', '0.5');
transmitter.setLevel(Number($('tx-level').value));
$('tx-level').addEventListener('input', (e) => { transmitter.setLevel(Number(e.target.value)); store.set('txLevel', e.target.value); });

$('tx-parity').value = store.get('txParity', 'even');
$('tx-parity').addEventListener('change', (e) => {
    store.set('txParity', e.target.value);
    if (qso.seq) qso.seq.txEven = e.target.value === 'even';
    renderQso();
});

async function fillOutputList() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput' && d.deviceId !== 'default');
    const select = $('tx-output');
    const saved = store.get('txOutput');
    select.replaceChildren(new Option('Default output', ''), ...outputs.map((d, i) => new Option(d.label || `Output ${i + 1}`, d.deviceId, false, d.deviceId === saved)));
    if (!transmitter.context?.setSinkId && !('setSinkId' in AudioContext.prototype)) select.disabled = true;
}
$('tx-output').addEventListener('change', async (e) => {
    store.set('txOutput', e.target.value);
    try { await transmitter.setOutputDevice(e.target.value); } catch (err) { showError(`Could not use that output: ${err.message}`); }
});
transmitter.outputDeviceId = store.get('txOutput');
fillOutputList();

$('tx-enable').addEventListener('change', async (e) => {
    if (e.target.checked && !qso.blocker() && !(source && sourceKind === 'test')) {
        try { await transmitter.ensureAudio(); } catch (err) { showError(`Audio output failed: ${err.message}`); }
    }
    qso.setEnabled(e.target.checked);
    e.target.checked = qso.enabled;
    renderQso();
});
$('call-cq').addEventListener('click', () => {
    qso.callCq({ even: $('tx-parity').value === 'even' });
});
function answerSelected() {
    if (!selectedDecode) return;
    if (!qso.answer(selectedDecode)) showError(`Can't answer "${selectedDecode.text}": no plain callsign to reply to.`);
}
$('answer').addEventListener('click', answerSelected);
$('stop-qso').addEventListener('click', () => qso.stopQso());
document.querySelectorAll('[data-halt]').forEach((b) => b.addEventListener('click', () => { qso.halt(); $('tx-enable').checked = false; }));
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (transmitter.current || qso.enabled)) { qso.halt(); $('tx-enable').checked = false; }
});
window.addEventListener('pagehide', () => { qso.halt(); radio.ptt(false).catch(() => {}); });
qso.addEventListener('change', renderQso);
qso.addEventListener('logged', (e) => addLogRow(e.detail));

const STATE_TEXT = {
    [STATE.IDLE]: () => 'Not in a QSO',
    [STATE.CQ]: () => 'Calling CQ, waiting for a reply',
    [STATE.CALLING]: (s) => `Calling ${s.dxCall}, waiting for a report`,
    [STATE.REPORT_SENT]: (s) => `In QSO with ${s.dxCall} · report ${s.sentReport} sent, waiting for theirs`,
    [STATE.ROGER_SENT]: (s) => `In QSO with ${s.dxCall} · report ${s.rcvdReport} received`,
    [STATE.SIGNING_OFF]: (s) => `In QSO with ${s.dxCall} · signing off`,
    [STATE.DONE]: (s) => `QSO with ${s.dxCall} complete and logged`,
};

function renderQso() {
    const seq = qso.seq;
    let state = STATE_TEXT[qso.state](seq ?? {});
    if (seq?.gaveUp) state = seq.dxCall ? `No reply from ${seq.dxCall}; stopped calling` : 'No reply to CQ; stopped calling';
    if (qso.next && !qso.enabled) state += ' · transmit is off';
    $('qso-state').textContent = state;

    const blocker = qso.blocker();
    $('tx-blocker').textContent = blocker ?? (qso.enabled || !qso.next ? '' : 'Tick Enable transmit to send the next message.');
    $('tx-enable').checked = qso.enabled;
    $('call-cq').disabled = !!blocker;
    const answerBtn = $('answer');
    const dx = selectedDecode ? parseMessageParts(selectedDecode.bits, selectedDecode.text)?.from?.text : null;
    answerBtn.hidden = !selectedDecode;
    answerBtn.textContent = dx ? `Answer ${dx.replace(/[<>]/g, '')}` : 'Answer';
    answerBtn.disabled = !!blocker;
    $('stop-qso').hidden = !seq || qso.state === STATE.IDLE || qso.state === STATE.DONE;
    if (seq?.txEven != null) $('tx-parity').value = seq.txEven ? 'even' : 'odd';

    // The six messages, with the next one marked.
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

    $('tx-help').textContent = (source && sourceKind === 'test')
        ? `Test mode: transmissions aren't played; the simulated band hears them. ${PARTNER.call} calls CQ and answers CQs.`
        : `Transmit audio goes to the audio output chosen above. PTT: ${radio.method === 'vox' ? 'the radio\'s VOX (see Radio control)' : radio.label}. Transmitting needs an amateur radio licence.`;
    renderBanner();
}

function renderBanner() {
    const tx = transmitter.current;
    const now = clock.now();
    const on = tx && now >= tx.slotStart;
    $('tx-banner').hidden = !on;
    if (on) {
        const left = Math.max(0, (tx.audioEnd - now) / 1000);
        $('tx-banner-text').textContent = `${tx.sent} · ${tx.freqHz} Hz · ${left.toFixed(0)} s left`;
    }
}

function addLogRow(c) {
    const tr = document.createElement('tr');
    const dial = radio.frequency ?? (sourceKind === 'rtlsdr' && source ? source.dialHz : null);
    const freq = dial ? `${(dial / 1e6).toFixed(3)} MHz` : '';
    for (const v of [utcTime(c.time), c.dxCall, c.dxGrid ?? '', c.sentReport ?? '', c.rcvdReport ?? '', freq]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
    }
    $('log-rows').prepend(tr);
    $('log-empty').hidden = true;
}

function updateControls() {
    const kind = selectedSource();
    $('source-help').textContent = help[kind];
    $('input-device').hidden = kind !== 'soundcard';
    bandSelect.hidden = kind !== 'rtlsdr';
    gainSelect.hidden = kind !== 'rtlsdr';
    if (kind === 'soundcard' && !$('input-device').options.length) fillDeviceList();
    const toggle = $('rx-toggle');
    if (kind === 'file') {
        toggle.textContent = 'Open audio file…';
    } else {
        toggle.textContent = source ? 'Stop receiving' : 'Start receiving';
    }
    $('level-wrap').hidden = !source;
    transmitter.useSoundCard = !(source && sourceKind === 'test');
    renderQso();
    if (lastError) setState(lastError, 'error');
    else if (source && sourceKind === 'test') setState('Receiving test signals', 'running');
    else if (source && sourceKind === 'rtlsdr') {
        const band = FT8_DIAL_FREQUENCIES.find(b => b.hz === source.dialHz);
        setState(`Receiving from ${fakeRtl ? 'simulated ' : ''}${source.deviceLabel} on ${(source.dialHz / 1e6).toFixed(3)} MHz${band ? ` (${band.band})` : ''}`, 'running');
    }
    else if (source) setState(`Receiving from ${source.deviceLabel || 'sound card'}`, 'running');
    else if (kind !== 'file') setState('Not receiving');
}

// ---- Clock display, about 10 times a second ----
const decodeMark = document.querySelector('.slot-decode');
decodeMark.style.left = `${(clock.mode.decodeAtSeconds / clock.mode.slotSeconds * 100).toFixed(1)}%`;
function tick() {
    const now = clock.now();
    $('utc').textContent = utcTime(now);
    const into = clock.secondsIntoSlot(now);
    document.querySelector('.slot-fill').style.width = `${(into / clock.mode.slotSeconds * 100).toFixed(1)}%`;
    document.querySelector('.slot-bar').setAttribute('aria-valuenow', into.toFixed(0));
    $('slot-label').textContent = `${clock.isEvenSlot(clock.slotIndex(now)) ? 'Even' : 'Odd'} slot · ${into.toFixed(1)} of ${clock.mode.slotSeconds} s`;
    const offset = clock.offsetMs / 1000;
    $('clock-offset').textContent = clock.offsetSource === OFFSET_SOURCE.NONE
        ? 'Clock: computer time'
        : `Clock: computer time ${offset >= 0 ? '+' : '−'}${Math.abs(offset).toFixed(2)} s (${clock.offsetSource === OFFSET_SOURCE.DECODES ? 'from decoded messages' : 'set manually'})`;
    if (source) {
        const level = Math.max(-60, Math.min(0, source.level));
        $('level').value = level;
        let levelText = Number.isFinite(source.level) ? `${source.level.toFixed(0)} dBFS` : '';
        if (source.level > -1) levelText += sourceKind === 'rtlsdr' ? ' · overloaded, lower the gain' : ' · clipping, lower the input level';
        $('level-db').textContent = levelText;
    }
}
setInterval(() => { tick(); qso.tick(); renderBanner(); }, 100);
tick();
updateControls();
pipeline.start().catch((err) => showError(`Decoder failed to load: ${err.message}. Reload the page to try again.`));

// For debugging from the browser console.
window.qso = { clock, pipeline, waterfall, bandActivity, transmitter, controller: qso, radio };
