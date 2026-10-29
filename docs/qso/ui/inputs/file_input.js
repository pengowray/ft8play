// Audio file input for the receive panel: decodes the first slot of a recording, shown on
// the waterfall like live audio. There is no running source; the button opens a file.

import { readAudioFile } from '../../sources/wav_file.js';
import { $ } from '../dom.js';

export class AudioFileInput {
    kind = 'file';
    realSignals = false;
    opensFile = true;
    help = 'Decodes the first 15 s of a recording. The recording must start at the beginning of a slot (:00, :15, :30 or :45 past the minute), such as a WAV file saved by WSJT-X.';

    /**
     * @param {{clock: object, pipeline: import('../../rx_pipeline.js').RxPipeline,
     *          setState: (text: string) => void, showError: (message: string) => void}} options
     */
    constructor({ clock, pipeline, setState, showError }) {
        Object.assign(this, { clock, pipeline, setState, showError });
        this.pending = null; // { label, seconds } while a file is being decoded
        this.fileInput = $('file-input');
        this.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) await this.decode(file);
        });
        pipeline.addEventListener('decodes', (e) => this.onDecodes(e.detail));
    }

    show() {}

    /** Opens the browser's file chooser. */
    open() {
        this.fileInput.click();
    }

    async decode(file) {
        this.setState(`Decoding ${file.name}…`);
        try {
            await this.pipeline.start();
            const { samples, seconds } = await readAudioFile(file, this.clock.mode.sampleRate);
            // The status changes to "Decoded" when the decoder's results arrive (see onDecodes).
            this.pending = { label: file.name, seconds };
            this.pipeline.decodeRecording(samples, file.name);
        } catch (err) {
            this.showError(`Could not read ${file.name}: ${err.message}`);
        }
    }

    onDecodes(result) {
        if (!this.pending || result.label !== this.pending.label) return;
        const { label, seconds } = this.pending;
        this.pending = null;
        this.setState(seconds > this.clock.mode.slotSeconds + 1
            ? `Decoded the first 15 s of ${label} (${seconds.toFixed(0)} s long)`
            : `Decoded ${label}`);
    }
}
