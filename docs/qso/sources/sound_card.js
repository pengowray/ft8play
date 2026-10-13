// Sound card input: a microphone or line input, or a radio's USB sound card.
// The browser resamples to 12 kHz (AudioContext sample rate); browser audio processing
// (echo cancellation, noise suppression, automatic gain) is turned off, since it removes FT8 signals.

export async function listInputDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
}

export class SoundCardSource {
    /**
     * @param {{clock: import('../slot_clock.js').SlotClock, onAudio: (samples: Float32Array, startTime: number) => void,
     *          deviceId?: string}} options
     */
    constructor({ clock, onAudio, deviceId = null }) {
        this.clock = clock;
        this.onAudio = onAudio;
        this.deviceId = deviceId;
        this.sampleRate = clock.mode.sampleRate;
        this.context = null;
        this.stream = null;
        this.node = null;
        this.level = -Infinity; // peak level of the last chunk, dBFS
        this.deviceLabel = '';
    }

    get running() {
        return this.context != null;
    }

    async start() {
        if (this.context) return;
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: this.deviceId ? { exact: this.deviceId } : undefined,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 1,
            },
        });
        this.deviceLabel = this.stream.getAudioTracks()[0]?.label ?? '';
        this.context = new AudioContext({ sampleRate: this.sampleRate });
        await this.context.audioWorklet.addModule(new URL('./audio_in_worklet.js', import.meta.url));
        const source = this.context.createMediaStreamSource(this.stream);
        this.node = new AudioWorkletNode(this.context, 'input-collector', {
            numberOfInputs: 1, numberOfOutputs: 0, processorOptions: { chunkSize: 1200 },
        });
        this.node.port.onmessage = (e) => this.onChunk(e.data);
        source.connect(this.node);
        await this.context.resume();
    }

    onChunk({ samples, frame }) {
        // Audio clock time of the first sample, mapped to the page clock, then corrected.
        const ts = this.context.getOutputTimestamp?.();
        let deviceMs;
        if (ts && ts.performanceTime) {
            const perfAtFrame = ts.performanceTime + (frame / this.sampleRate - ts.contextTime) * 1000;
            deviceMs = performance.timeOrigin + perfAtFrame;
        } else {
            deviceMs = Date.now() - (samples.length / this.sampleRate) * 1000;
        }
        // Input latency (time from the antenna to this sample being readable).
        deviceMs -= (this.context.baseLatency || 0) * 1000;
        let peak = 0;
        for (const v of samples) peak = Math.max(peak, Math.abs(v));
        this.level = 20 * Math.log10(peak || 1e-9);
        this.onAudio(samples, deviceMs + this.clock.offsetMs);
    }

    async stop() {
        this.stream?.getTracks().forEach(t => t.stop());
        await this.context?.close();
        this.context = null;
        this.stream = null;
        this.node = null;
    }
}
