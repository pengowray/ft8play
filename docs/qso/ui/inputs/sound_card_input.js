// Sound card input for the receive panel: the device list, and starting a SoundCardSource.
// Each input module has the same shape (see receive_panel.js): kind, realSignals, help,
// show(), start(), status(), startError(), levelWarning.

import { SoundCardSource, listInputDevices } from '../../sources/sound_card.js';
import { bandName } from '../../bands.js';
import { $, store, formatMHz } from '../dom.js';

const HELP = 'Receives audio from a sound card input, such as a radio\'s USB audio. Set the radio to upper sideband (USB) on an FT8 frequency, and choose the same frequency from the Dial frequency list so the log records it. The browser will ask for microphone permission.';
// With CAT the page sets the radio's mode itself (see radio_control.js connect).
const HELP_CAT = 'Receives audio from a sound card input, such as a radio\'s USB audio. Choose an FT8 frequency from the Dial frequency list to tune the radio. The browser will ask for microphone permission.';

export class SoundCardInput {
    kind = 'soundcard';
    realSignals = true;
    levelWarning = ' · clipping, lower the recording level';

    /**
     * @param {{dial: import('../../dial.js').Dial, cat: () => boolean, restart: () => Promise<void>}} options
     *   cat: true while radio control reads the radio's frequency;
     *   restart: stops and starts receiving again (after the device changes)
     */
    constructor({ dial, cat, restart }) {
        this.dial = dial;
        this.cat = cat;
        this.field = $('input-device-field');
        this.deviceSelect = $('input-device');
        this.deviceSelect.addEventListener('change', async (e) => {
            store.set('inputDevice', e.target.value);
            await restart();
        });
    }

    get help() {
        return this.cat() ? HELP_CAT : HELP;
    }

    show(on) {
        this.field.hidden = !on;
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
        const hz = this.dial.hz;
        const band = bandName(hz);
        return `Receiving from ${source.deviceLabel || 'sound card'}${hz ? ` on ${formatMHz(hz)}${band ? ` (${band})` : ''}` : ''}`;
    }

    startError(err) {
        if (err.name === 'NotAllowedError') return 'Microphone permission was refused. Allow it in the browser\'s site settings, then try again.';
        return null;
    }
}
