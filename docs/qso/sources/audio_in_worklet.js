// AudioWorklet processor: collects input samples and posts them to the page in chunks,
// with the audio clock frame number of the first sample.

class InputCollector extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.chunkSize = options.processorOptions?.chunkSize ?? 1200;
        this.buffer = new Float32Array(this.chunkSize);
        this.fill = 0;
        this.firstFrame = 0;
    }

    process(inputs) {
        const input = inputs[0]?.[0];
        if (!input) return true;
        for (let i = 0; i < input.length; i++) {
            if (this.fill === 0) this.firstFrame = currentFrame + i;
            this.buffer[this.fill++] = input[i];
            if (this.fill === this.chunkSize) {
                this.port.postMessage({ samples: this.buffer, frame: this.firstFrame }, [this.buffer.buffer]);
                this.buffer = new Float32Array(this.chunkSize);
                this.fill = 0;
            }
        }
        return true;
    }
}

registerProcessor('input-collector', InputCollector);
