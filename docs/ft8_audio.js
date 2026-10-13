// Audio for one FT8 message: synthesis (ft8_lib's GFSK synthesizer) and playback.
// Kept apart from FT8Message so the message model can be used without Web Audio.
//
// Events: 'queue' (waiting for the next 15 s slot), 'play', 'stop'.

import { ft8lib } from './ft8_engines.js';

export class MessageAudio extends EventTarget {

    /** @param {import('./ft8_msg.js').FT8Message} message */
    constructor(message) {
        super();
        this.message = message;

        // overrides of defaults
        this.baseFrequency = null; // 1000
        this.sampleRate = null; // 12000
        this.toneSpacing = null; // 6.25
        this.customToneFrequencies = null;
        this.symbolBT = null; // 2.0
        this.symbolPeriod = null; // 0.160
        //this.numOfSymbols = null; // 79 (todo)

        this.audioSamples = null;
        this.dphiSamples = null;
        this.levelsSamples = null;
        this.metadata = null;

        // for playing
        this.isPlaying = false; // == (audioSource != null)
        this.playStartTime = null;

        // all should be null when not queuing
        this.queuingStartedAt = null; // if playing is queued for next 15s
        this.queuingUntil = null; // when to start playing
        this.queueInterval = null; // check if ready to play

        this.audioContext = null;
        this.audioBuffer = null;
        this.channelData = null;
        this.audioSource = null; // only not null while playing
    }

    getTiming() {
        const isPlaying = this.isPlaying;
        const audioCurrentTime = (this.audioContext) ? this.audioContext.currentTime : null;
        //const startTime = this.playStartTime;
        const startTime = this.playStartTime ?? 0;
        const currentTime =  audioCurrentTime - startTime;
        //const currentTime =  audioCurrentTime;
        const duration = this.audioBuffer ? this.audioBuffer.duration : null;

        let remainingTime = duration - currentTime;
        if (remainingTime < 0) remainingTime = 0;

        let progress = currentTime / duration * 100;
        if (progress < 0) progress = 0;
        if (progress > 100) progress = 100;

        //TODO: use metadata to get audio start/end/symbol durations
        let symbolDuration = 0.160; // default
        if (this.audioBuffer != null && this.audioBuffer.duration) symbolDuration = this.audioBuffer.duration / 79; // 79 symbols in FT8
        const currentSymbolIndex = Math.floor(currentTime / symbolDuration);
        //const currentSymbolIndex = Math.floor(audioCurrentTime / symbolDuration);

        return { isPlaying, audioCurrentTime, startTime,  currentTime, duration, remainingTime, progress, currentSymbolIndex };
    }

    setAudioOptions(sampleRate, baseFrequency, customToneFrequencies = null) {
        this.sampleRate = sampleRate;
        this.baseFrequency = baseFrequency;
        this.customToneFrequencies = customToneFrequencies;
    }

    clearAudioData() {
        this.audioSamples = null;
        this.dphiSamples = null;
        this.levelsSamples = null;
        //this.metadata = null;
        this.audioBuffer = null;
        this.channelData = null;
        //this.audioContext = null; // reuse? stop audio first?
        this.audioSource = null;
    }

    readyAudio() {
        if (this.audioSamples == null) {
            this.generateAudio();
        }
    }

    readyAudioAndBuffer() {
        this.readyAudio();

        if (this.audioSamples == null || this.audioSamples.length == 0) {
            // failed to generate audio
            return;
        }

        //aka setupAudioPlayback()

        const sampleRate = this.getSampleRate();

        this.audioContext = this.audioContext || new window.AudioContext({ sampleRate: sampleRate });
        this.audioBuffer = this.audioBuffer || this.audioContext.createBuffer(1, this.audioSamples.length, sampleRate);
        if (this.channelData == null) {
            this.channelData = this.audioBuffer.getChannelData(0);
            this.channelData.set(this.audioSamples);
        }
    }

    queueTimeRemaining() {
        if (!this.queuingStartedAt || !this.queuingUntil) return null;
        const seconds = (this.queuingUntil - new Date().getTime()) / 1000;
        return seconds < 0 ? 0 : seconds;
    }

    queueAudio() {
        if (this.isPlaying) return false; // already playing
        if (this.queuingStartedAt) return false; // already queued

        this.readyAudioAndBuffer();

        if (!this.audioContext) {
            console.error("No audio context");
            return false;
        }

        this.queuingStartedAt = Date.now();
        const now = new Date().getSeconds();
        const latency = (this.audioContext?.outputLatency ?? 0);
        const secondsUntilNext15 = 15 - ((now + latency) % 15);
        let nextCycleTime = new Date().getTime() + secondsUntilNext15 * 1000;
        this.queuingUntil = nextCycleTime;

        this.queueInterval = setInterval(() => {
            const currentTime = new Date().getTime();
            if (!this.queueInterval || !this.queuingUntil || this.isPlaying) {
                clearInterval(this.queueInterval);
                return;
            }
            if (currentTime >= this.queuingUntil) {
                clearInterval(this.queueInterval);
                this.playAudio();
            }
        }, 90); // Check every 90ms

        this.dispatchEvent(new Event('queue'));
    }

    playAudio() {
        if (this.isPlaying) return false;

        if (this.queuingStartedAt) {
            this.queuingStartedAt = null;
            this.queuingUntil = null;
        }

        this.readyAudioAndBuffer();
        if (!this.audioBuffer) return false;

        this.isPlaying = true;

        this.audioContext.resume().then(() => {
            console.log("Audio context resumed");
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = this.audioBuffer;
            this.audioSource.connect(this.audioContext.destination);
            this.audioSource.start();

            this.audioSource.onended = () => this.resetAudioState();
            this.dispatchEvent(new Event('play'));

            this.playStartTime = this.audioContext.currentTime;
        });
        return true;
    }

    resetAudioState() {
        console.log("resetAudioState (stopping)");
        this.isPlaying = false;
        this.playStartTime = null;

        if (this.audioSource) this.audioSource.onended = null;
        if (this.audioSource) this.audioSource.stop();
        this.queuingStartedAt = null;
        this.queuingUntil = null;

        this.dispatchEvent(new Event('stop'));
    }

    getSampleRate() {
        return this.sampleRate ?? 12000;
    }
    getBaseFrequency() {
        return this.baseFrequency ?? 1000;
    }
    getOptions() {
        //TODO: cache this
        return {
            baseFrequency: this.getBaseFrequency(),
            sampleRate: this.getSampleRate(),
            toneSpacing: this.toneSpacing ?? 6.25,
            customToneFrequencies: this.customToneFrequencies ?? null,
            symbolBT: this.symbolBT ?? 2.0,
            symbolPeriod: this.symbolPeriod ?? 0.160
        };
    }

    /*
    updates this.audioSamples, this.dphiSamples, this.metadata
    */
    generateAudio() {
        const options = this.getOptions();
        const symbolsText = this.message.symbolsText;
        if (symbolsText == null) return;

        const numSymbols = symbolsText.length;

        // Allocate memory for symbols string
        const symbolsPtr = ft8lib.module._malloc(numSymbols + 1); // +1 for null terminator
        for (let i = 0; i < numSymbols; i++) {
            ft8lib.module.HEAP8[symbolsPtr + i] = symbolsText.charCodeAt(i);
        }
        ft8lib.module.HEAP8[symbolsPtr + numSymbols] = 0; // Null terminator

        // Calculate number of samples
        let numSamples = ft8lib.module._calculate_num_samples(numSymbols, options.symbolPeriod, options.sampleRate);

        // Allocate memory for audio and dphi
        const audioPtr = ft8lib.module._malloc(numSamples * 4);
        const dphiPtr = ft8lib.module._malloc(numSamples * 4);
        const levelsPtr = ft8lib.module._malloc(numSamples * 4);

        // Allocate memory for metadata
        const metadataLengthPtr = ft8lib.module._malloc(4);
        const metadataJsonPtrPtr = ft8lib.module._malloc(4);
        const FT8_TONE_COUNT = 8;

        const n_start_delay = 0;  // Set to 0 for now
        const n_end_extension = 0;  // Set to 0 for now

        if (options.customToneFrequencies != null) {
            // Use custom tone frequencies
            const toneOffsetsPtr = ft8lib.module._malloc(FT8_TONE_COUNT * 4);
            const toneOffsets = new Float32Array(ft8lib.module.HEAPF32.buffer, toneOffsetsPtr, FT8_TONE_COUNT);
            for (let i = 0; i < FT8_TONE_COUNT; i++) {
                toneOffsets[i] = options.customToneFrequencies[i];
            }

            ft8lib.module._synth_gfsk_custom(
                symbolsPtr, options.baseFrequency, toneOffsetsPtr,
                options.symbolBT, options.symbolPeriod, options.sampleRate,
                n_start_delay, n_end_extension,
                audioPtr, dphiPtr, levelsPtr, metadataLengthPtr, metadataJsonPtrPtr
            );

            ft8lib.module._free(toneOffsetsPtr);
        } else {
            // Use default FT8 frequencies
            ft8lib.module._synth_gfsk_custom(
                symbolsPtr, options.baseFrequency, 0, // Pass 0 for custom_tones when using default
                options.symbolBT, options.symbolPeriod, options.sampleRate,
                n_start_delay, n_end_extension,
                audioPtr, dphiPtr, levelsPtr, metadataLengthPtr, metadataJsonPtrPtr
            );
        }

        const audio = new Float32Array(ft8lib.module.HEAPF32.buffer, audioPtr, numSamples);
        const dphi = new Float32Array(ft8lib.module.HEAPF32.buffer, dphiPtr, numSamples);
        const levels = new Float32Array(ft8lib.module.HEAPF32.buffer, levelsPtr, numSamples);
        this.audioSamples = Array.from(audio);

        const dphiArray = Array.from(dphi);
        this.dphiSamples = scaleToRange(dphiArray, 190, 10);

        const levelsArray = Array.from(levels);
        this.levelsSamples = scaleToRange(levelsArray, 195, 5);

        const metadataLength = ft8lib.module.HEAP32[metadataLengthPtr / 4];
        const metadataJsonPtr = ft8lib.module.HEAP32[metadataJsonPtrPtr / 4];
        const metadataStr = ft8lib.module.UTF8ToString(metadataJsonPtr, metadataLength);

        try {
            this.metadata = JSON.parse(metadataStr);
        } catch {
            console.error("(internal error) Failed to parse metadata: '" + metadataStr + "'");
        } finally {
            // Free allocated memory
            ft8lib.module._free(symbolsPtr);
            ft8lib.module._free(audioPtr);
            ft8lib.module._free(dphiPtr);
            ft8lib.module._free(levelsPtr);
            ft8lib.module._free(metadataLengthPtr);
            ft8lib.module._free(metadataJsonPtrPtr);
            ft8lib.module._free(metadataJsonPtr);
        }
    }
}


/**
 * @param {Array} numbers - array of numbers to scale
 * @param {number} newMin - new minimum value of the scaled range
 * @param {number} newMax - new maximum value of the scaled range
 * @returns {Array} - The array of numbers scaled to the new range
 */
export function scaleToRange(numbers, newMin, newMax) {
    const { min: originalMin, max: originalMax } = findMinAndMax(numbers);
    const scale = (newMax - newMin) / (originalMax - originalMin);

    return numbers.map(num => (num - originalMin) * scale + newMin);
}

export function findMinAndMax(numbers) {
    let min = Infinity;
    let max = -Infinity;

    for (const num of numbers) {
        if (num < min) min = num;
        if (num > max) max = num;
    }

    return { min, max };
}
