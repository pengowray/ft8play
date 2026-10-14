// FT8 QSO page: creates the slot clock, receive pipeline, transmitter, QSO controller and
// radio control, and connects them to the page's panels (ui/*.js).
//
// URL options: ?fake-rtlsdr  simulated RTL-SDR, for testing without one
//              ?fake-radio   simulated QMX on a pretend serial port

import { SlotClock } from './slot_clock.js';
import { RxPipeline } from './rx_pipeline.js';
import { Waterfall } from './waterfall.js';
import { BandActivity, utcTime } from './band_activity.js';
import { Transmitter } from './tx.js';
import { QsoController } from './qso_controller.js';
import { RadioControl } from './radio/radio_control.js';
import { $, store, formatMHz } from './ui/dom.js';
import { ReceivePanel } from './ui/receive_panel.js';
import { RadioPanel, connectPtt } from './ui/radio_panel.js';
import { TransmitPanel } from './ui/transmit_panel.js';
import { LogPanel } from './ui/log_panel.js';
import { ClockDisplay } from './ui/clock_display.js';

const params = new URLSearchParams(location.search);

const clock = new SlotClock();
const pipeline = new RxPipeline({ clock });
const waterfall = new Waterfall(document.querySelector('.waterfall'));
const transmitter = new Transmitter({ clock });
const qso = new QsoController({ clock, transmitter });
const radio = new RadioControl({ fake: params.has('fake-radio') });

const receive = new ReceivePanel({ clock, pipeline, fakeRtl: params.has('fake-rtlsdr') });
const onError = (message) => receive.showError(message);
const testMode = () => receive.testMode;
const transmit = new TransmitPanel({ clock, transmitter, qso, radio, testMode, waterfall, onError });
const bandActivity = new BandActivity(document.querySelector('.band-activity'), {
    onHover: (d) => waterfall.showSignal(d ? d.freqHz : null),
    onSelect: (d) => transmit.select(d),
    onPick: (d) => { transmit.select(d); transmit.answerSelected(); },
});
new RadioPanel({ radio, onError });
connectPtt({ transmitter, radio, testMode, halt: () => qso.halt(), onError });
const log = new LogPanel();
const clockDisplay = new ClockDisplay(clock);

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

// ---- Receiving ----
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
    // Correct the clock from received signals, but not from simulated ones.
    if (receive.realSignals && typeof result.slot === 'number') {
        clock.addSlotDts(result.slot, result.decodes.filter(d => d.snr == null || d.snr > -18).map(d => d.dt));
    }
});
pipeline.addEventListener('error', (e) => onError(`Decoder error: ${e.detail.message}`));

// In test mode, transmissions go to the simulated band instead of the sound card.
// Entering or leaving test mode halts transmitting, so a QSO with the simulated station
// can't carry on over the air (or the other way round).
let wasTestMode = false;
receive.addEventListener('change', () => {
    if (receive.testMode !== wasTestMode) {
        wasTestMode = receive.testMode;
        transmit.halt();
    }
    transmitter.useSoundCard = !receive.testMode;
    transmit.render();
});
transmitter.addLoopback((tx) => { if (receive.testMode) receive.source.hear(tx); });

// ---- Log ----
qso.addEventListener('logged', (e) => {
    const dial = radio.frequency ?? receive.dialHz;
    log.add(e.detail, receive.testMode ? 'test mode' : dial ? formatMHz(dial) : 'unknown');
});

// ---- Clock, level meter, transmit timing: about 10 times a second ----
setInterval(() => {
    clockDisplay.render();
    receive.renderLevel();
    qso.tick();
    transmit.renderBanner();
}, 100);
clockDisplay.render();
receive.render();
pipeline.start().catch((err) => onError(`Decoder failed to load: ${err.message}. Reload the page to try again.`));

// For debugging from the browser console.
window.qso = { clock, pipeline, waterfall, bandActivity, transmitter, controller: qso, radio, receive, transmit };
