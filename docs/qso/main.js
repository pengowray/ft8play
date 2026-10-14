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
const bandActivity = new BandActivity(document.querySelector('.band-activity'), {
    onHover: (d) => waterfall.showSignal(d ? d.freqHz : null),
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
    store.set('myCall', call);
    pipeline.setMyCall(call);
    bandActivity.setMyCall(call);
}
myCallInput.addEventListener('change', applyMyCall);
myGridInput.addEventListener('change', () => store.set('myGrid', myGridInput.value.trim().toUpperCase()));
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
setInterval(tick, 100);
tick();
updateControls();
pipeline.start().catch((err) => showError(`Decoder failed to load: ${err.message}. Reload the page to try again.`));

// For debugging from the browser console.
window.qso = { clock, pipeline, waterfall, bandActivity };
