import { grayBitsToSymbols, encodeFT8FreeText, packedDataTo80Bits, getFT8MessageType, normalizeMessage, normalizeMessageAndHashes, normalizeBracketedFreeText, checkSync, checkCRC, checkParity, repairErrorsOnce, symbolsToBitsStrNoCosta, symbolsToPackedData  } from "./ft8_extra.js";
import * as extra from "./ft8_extra.js";
import * as hashmgr from "./ft8_hashmgr.js";
import FT8LIB from "./ft8_ft8lib.js";
import MSHVFT8 from "./mshv_ft8_wrap.js";

const ft8lib = new FT8LIB();
const mshvft8 = new MSHVFT8();

class FT8Message extends EventTarget {

    initSymbolsText(symbolsText) {
        this.symbolsText = symbolsText;
        this.packedData = extra.symbolsToPackedData(symbolsText);
        this.bits = extra.symbolsToBitsStrNoCosta(this.symbolsText).slice(0, 77); // == symbolsToBitsStr(this.symbolsText).slice(21, 108);
        this.postInit();
    }

    initPackedData(packedData) {
        this.packedData = packedData;
        this.symbolsText = ft8lib.packedDataToSymbols(this.packedData);
        this.bits = extra.symbolsToBitsStrNoCosta(this.symbolsText).slice(0, 77);
        this.postInit();
    }

    initBits(bits77) {
        this.bits = bits77;
        this.packedData = extra.bitsToPacked(bits77);
        this.symbolsText = ft8lib.packedDataToSymbols(this.packedData);
        this.postInit();
    }

    initMessage(text, encoder) {
        // note: text assumed to be normalized and uppercase
        if (encoder === 'ft8lib') {
            //var result = ft8lib.encodeFT8Message(text);            
            const packingResult = ft8lib.messageToPackedData(text);
            if (packingResult.success) {
                this.initPackedData(packingResult.data);

            } else {
                throw new Error(`Encoding failed (code ${packingResult.errorCode}): ${packingResult.errorMessage}`);
            }

        } else if (encoder === 'mshv') {
            const mshvPackingResult = mshvft8.packMessage(text);
            if (mshvPackingResult.errorCode == 0 && mshvPackingResult.message) {
                this.initBits(mshvPackingResult.message);
            } else {
                this.encodeError = mshvPackingResult.errorCode;
            }
        } else {
            throw new Error("Unknown encoder or No encoder specified: '" + encoder + "'");
        }
    }

    postInit() {
        // todo: separate checks and additions

        this.packetType ??= (this.ft8MessageType !== null && ft8MessageType === 'spp') ? 'spp' : 'ft8';

        if (this.symbolsText == null && this.packedData != null) {
            console.log("empty symbols, generating from packed data (should not happen).")
            this.symbolsText = ft8lib.packedDataToSymbols(this.packedData);

        } else if (this.packedData == null && this.symbolsText != null) {
            console.log("empty packed data, generating from symbols (should not happen)");
            this.packedData = extra.symbolsToPackedData(this.symbolsText);
        }

        if (this.symbolsText == null) {
            this.encodeError = "Failed to generate symbols";
            throw new Error(this.encodeError);
        }

        if (this.packedData == null) {
            this.encodeError = "Failed to generate packed data";
            throw new Error(this.encodeError);
        }

        var packedBits = extra.packedDataTo80Bits(this.packedData);
        const zeroPadding = packedBits.slice(77);
        //this.bits = packedBits.slice(0, 77);
        if ((this.packetType == null || this.packetType === 'ft8') && zeroPadding != '000') {
            this.encodeError = `Packed data not zero padded (Expected 77 bits + 3 zeros), Got: ${packedBits}`;
            throw new Error(this.encodeError);
        }

        if (this.bits != packedBits.slice(0, 77)) {
            throw new Error("Packed data does not match bits");
        }

        this.ft8MessageType ??= extra.getFT8MessageType(this.bits);

        // re-encoding messages
        
        //TODO: use both / use consistant format
        //TODO: add ft8play decode
        //TODO: should it use hashmgr?
        this.ft8libDecodedResult = ft8lib.decodeFT8FromPackedData(this.packedData, this.packedData.length);
        
        // translate into ft8libDecodedResult format; TODO: should be other way around
        const resultMshv = mshvft8.unpackMessage(this.bits);
        if (resultMshv != null && resultMshv.errorCode == 0) {
            this.mshvDecodedResult = {success: true, resultText: resultMshv.message, result: resultMshv.message, decodedText: resultMshv.message };
        } else {
            this.mshvDecodedResult = {success: false, error: true, result: 'error', errorMessage: resultMshv?.message, errorCode: resultMshv.errorCode, decodedText: null };
        }

        this.bestDecodedResult = this.mshvDecodedResult?.success ? this.mshvDecodedResult : (this.ft8libDecodedResult?.success ? this.ft8libDecodedResult : this.mshvDecodedResult);
    }

    bestDecodedResultFromExpected(expectedResults) {
        if (expectedResults == null) {
            this.bestDecodedResult = null;
            return;
        }
        
        if (!expectedResults.error) {
            this.bestDecodedResult = {success: true, resultText: expectedResults.message, result: expectedResults.message, decodedText: expectedResults.message };
        } else {
            this.bestDecodedResult = {success: false, error: true, result: 'error', result: expectedResults.message, errorMessage: 'Could not unpack in reference', decodedText: expectedResults.decoded };
            this.decodingError = expectedResults.decoded;

        }


        return null;
    }

    constructor(inputText, expectedResults = null) {
      super();

      this.inputText = inputText;

      this.normalizedInput = null;
      this.inputType = null; // can be manual set, otherwise auto-detected
      this.expectedResults = expectedResults; // if running test against known input

      // Always set all three by calling one of the init methods (unless there's an error)
      this.symbolsText = null;
      this.packedData = null;
      this.bits = null; // string of 77 bits

      this.allBits = null; // all bits needed for annotations: 80 bits for SPP; will be 237 bits for FT8 but keeping it null for now
      this.packetType = null; // 'ft8' or 'spp
      this.ft8MessageType = null;

      // results of encoding
      this.encodeError = null;

      // results of decoding final packed message
      this.ft8libDecodedResult = null;
      this.mshvDecodedResult = null;
      this.bestDecodedResult = null;

      this.tabs = null;

      // cached checks
      this.SyncCheck = null;
      this.CRCCheck = null;
      this.ParityCheck = null; // LDPC

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

      // for playing
      this.isPlaying = false; // == (audioSource != null)
      this.playStartTime = null;

      // all should be null when not queuing
      this.queuingStartedAt = null; // if playing is queued for next 15s
      this.queuingUntil == null; // when to start playing
      this.queueInterval = null; // check if ready to play

      this.audioContext = null;
      this.audioBuffer = null;
      this.channelData = null;
      this.audioSource = null; // only not null while playing

      // ViewManager for reporting audio stop/start/queued/etc
      this.viewManager = null;

      if (hashmgr && hashmgr.mshvft8 == null) {
          hashmgr.setMshvft8(mshvft8);
      }
      
      //this.hashes = hashmgr.hashes;

      // setup Event Listeners
      //this.dispatchEvent(new Event('queue'));
      //this.dispatchEvent(new Event('play'));
      //this.dispatchEvent(new Event('pause'));
      //this.audioSource.onended = () => this.dispatchEvent(new Event('stop'));

      //usage example:
      //msg.addEventListener('play', () => console.log('Audio started playing'));
    }
    
    getSyncCheck() {
        if (this.SyncCheck == null) this.SyncCheck = checkSync(this.symbolsText);
        return this.SyncCheck;
    }
    getCRCCheck() {
        if (this.CRCCheck == null) this.CRCCheck = checkCRC(this.symbolsText);
        return this.CRCCheck;
    }
    getParityCheck() { // LDPC check
        if (this.ParityCheck == null) this.ParityCheck = checkParity(this.symbolsText);
        return this.ParityCheck;
    }
    getParityRepairedCodeword() {
        // returns null if nothing to repair
        const parityCheck = this.getParityCheck();
        if (parityCheck == null || parityCheck.success) return null;
        const repaired = extra.repairErrorsOnce(symbolsToBitsStrNoCosta(this.symbolsText), parityCheck);
        return repaired;
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

    clearAllCached() {
        this.SyncCheck = null;
        this.CRCCheck = null;
        this.ParityCheck = null;
        this.clearAudioData();
        //TODO: clear everything generated by encode() except maybe symbols and packedData
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

        const sampleRate = this.getSampleRate(); // message.getOptions().sampleRate;
        //const metadata = message.metadata;

        //this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sampleRate });
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
        //const displaySecondsUntilNext15 = 15 - (now % 15);
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
    
        if (this.viewManager) this.viewManager.onQueue(this);
        this.dispatchEvent(new Event('queue'));
    }

    playAudio() {
        //if (this.audioSource) { return; /* already playing */ }
        if (this.isPlaying) return false;

        if (this.queuingStartedAt) {
            this.queuingStartedAt = null;
            this.queuingUntil = null;
        }

        this.readyAudioAndBuffer();
        if (!this.audioBuffer) return false;
        
        const msg = this;
        msg.isPlaying = true;

        this.audioContext.resume().then(() => {
            console.log("Audio context resumed");
            msg.audioSource = msg.audioContext.createBufferSource();
            msg.audioSource.buffer = msg.audioBuffer;
            msg.audioSource.connect(msg.audioContext.destination);
            msg.audioSource.start();
            
            msg.audioSource.onended = () => this.resetAudioState();
            if (this.viewManager) this.viewManager.onPlay(this);

            msg.playStartTime = msg.audioContext.currentTime;
        });
        //if (this.viewManager) this.viewManager.onPlay(this);
        return true;
    }
    
    resetAudioState() {
        console.log("resetAudioState (stopping)");
        this.isPlaying = false;
        this.playStartTime = null;

        if (this.audioSource) this.audioSource.onended = null;
        if (this.audioSource) this.audioSource.stop();
        //this.clearAudioAndBuffer();
        this.queuingStartedAt = null;
        this.queuingUntil = null;

        if (this.viewManager) this.viewManager.onStop(this);
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
        if (this.symbolsText == null) return;
    
        const numSymbols = this.symbolsText.length;
        
        // Allocate memory for symbols string
        //const symbolsPtr = Module.stringToUTF8(this.symbolsText);
        const symbolsPtr = ft8lib.module._malloc(numSymbols + 1); // +1 for null terminator
        for (let i = 0; i < numSymbols; i++) {
            ft8lib.module.HEAP8[symbolsPtr + i] = this.symbolsText.charCodeAt(i);
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
    
        let result;
        const n_start_delay = 0;  // Set to 0 for now
        const n_end_extension = 0;  // Set to 0 for now
    
        if (options.customToneFrequencies != null) {
            // Use custom tone frequencies
            const toneOffsetsPtr = ft8lib.module._malloc(FT8_TONE_COUNT * 4);
            const toneOffsets = new Float32Array(ft8lib.module.HEAPF32.buffer, toneOffsetsPtr, FT8_TONE_COUNT);
            for (let i = 0; i < FT8_TONE_COUNT; i++) {
                toneOffsets[i] = options.customToneFrequencies[i];
            }
    
            result = ft8lib.module._synth_gfsk_custom(
                symbolsPtr, options.baseFrequency, toneOffsetsPtr,
                options.symbolBT, options.symbolPeriod, options.sampleRate,
                n_start_delay, n_end_extension,
                audioPtr, dphiPtr, levelsPtr, metadataLengthPtr, metadataJsonPtrPtr
            );
    
            ft8lib.module._free(toneOffsetsPtr);
        } else {
            // Use default FT8 frequencies
            result = ft8lib.module._synth_gfsk_custom(
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
            error = "(internal error) Failed to parse metadata: '" + metadataStr + "'";
            console.error(error);
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
function scaleToRange(numbers, newMin, newMax) {
    const { min: originalMin, max: originalMax } = findMinAndMax(numbers);
    //console.log("min/max:", originalMin, originalMax);
    const scale = (newMax - newMin) / (originalMax - originalMin);
    
    return numbers.map(num => (num - originalMin) * scale + newMin);
}

function findMinAndMax(numbers) {
    let min = Infinity;
    let max = -Infinity;
    
    for (const num of numbers) {
        if (num < min) min = num;
        if (num > max) max = num;
    }
    
    return { min, max };
}


export { 
    // needed
    FT8Message,

    // meh (probably internal)
    scaleToRange, findMinAndMax
};
