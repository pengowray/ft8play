// Sound card input for the receive panel: the device list, and starting a SoundCardSource.
// Each input module has the same shape (see receive_panel.js): kind, realSignals, help,
// show(), start(), status(), startError(), levelWarning.

import { SoundCardSource, listInputDevices } from '../../sources/sound_card.js';
import { $, store, bandOptions } from '../dom.js';

const HELP = 'Receives audio from a sound card input, such as a radio\'s USB audio. Set the radio to upper sideband (USB) on an FT8 frequency, and choose the same dial frequency from the list so the log records it. The list does not tune the radio. The browser will ask for microphone permission.';
const HELP_CAT = 'Receives audio from a sound card input, such as a radio\'s USB audio. Set the radio to upper sideband (USB) on an FT8 frequency. Radio control (CAT) reads the dial frequency from the radio for the log. The browser will ask for microphone permission.';

export class SoundCardInput {
    kind = 'soundcard';
    realSignals = true;
    levelWarning = ' · clipping, lower the recording level';

    /**
     * @param {{radioFrequency: () => number|null, restart: () => Promise<void>}} options
     *   restart: stops and starts receiving again (after the device changes)
     */
    constructor({ radioFrequency, restart }) {
        this.radioFrequency = radioFrequency;
        this.deviceSelect = $('input-device');
        this.dialSelect = $('soundcard-dial');
        this.deviceSelect.addEventListener('change', async (e) => {
            store.set('inputDevice', e.target.value);
            await restart();
        });
        // Starts unset, so a QSO isn't logged on a band the user never chose.
        this.dialSelect.replaceChildren(new Option('Choose dial frequency', ''), ...bandOptions());
        this.dialSelect.value = store.get('soundcardDial', '');
        this.dialSelect.addEventListener('change', () => store.set('soundcardDial', this.dialSelect.value));
    }

    get help() {
        return this.radioFrequency() ? HELP_CAT : HELP;
    }

    /** The radio's dial frequency as the user chose it (only used for the log), or null. */
    get dialHz() {
        return Number(this.dialSelect.value) || null;
    }

    /** Shows or hides this input's settings. The dial list is hidden while CAT reads the frequency. */
    show(on) {
        this.deviceSelect.hidden = !on;
        this.dialSelect.hidden = !on || !!this.radioFrequency();
        if (on && !this.deviceSelect.options.length) this.fillDeviceList();
    }

    async fillDeviceList() {
        const devices = await listInputDevices();
        const saved = store.get('inputDevice');
        this.deviceSelect.replaceChildren(...devices.map((d, i) =>
            new Option(d.label || (i === 0 ? 'Default input' : `Input ${i + 1}`), d.deviceId, false, d.deviceId === saved)));
    }

    async start({ clock, onAudio }) {
        const source = new SoundCardSource({ clock, onAudio, deviceId: store.get('inputDevice') || null });
        await source.start();
        await this.fillDeviceList(); // labels are only available after permission is granted
        return source;
    }

    status(source) {
        return `Receiving from ${source.deviceLabel || 'sound card'}`;
    }

    startError(err) {
        if (err.name === 'NotAllowedError') return 'Microphone permission was refused. Allow it in the browser\'s site settings, then try again.';
        return null;
    }
}
