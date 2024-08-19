const hashes = {}; // a little global never hurt noone

function addHash(callsign) {
    //TODO: watch for conflicts
    //TODO: priorty levels
    if (callsign == null) return;
    
    callsign = callsign.toUpperCase().trim();
    if (callsign == '') return;

    if (callsign.startsWith('<') && callsign.endsWith('>')) {
        callsign = callsign.slice(1, -1).trim();
        if (callsign == '') return;
    }

    const hashInt = hashCallsign(callsign);
    if (hashInt == null) return;
    const hashBits = hashInt.toString(2).padStart(22, '0');
    const zhash = hashBitsToZ32Dense(hashBits);
    const entry = [hashInt, callsign];

    if (zhash) {
        // 22, 12 and 10 bit hashes.
        // hashes[aabcc] = [hashInt, callsign]
        // hashes[aab] = [hashInt, callsign]
        // hashes[aa] = [hashInt, callsign]
        hashes[zhash] = entry; // 22 bits
        hashes[zhash.slice(0, 3)] = entry; // 12 bits
        hashes[zhash.slice(0, 2)] = entry; // 10 bits
    }
}
function findHash(bits) {
    //todo: accept int too; use: callsignToHashBits(hashInt)
    const zhash = hashBitsToZ32Dense(bits);
    if (zhash == null || zhash == '') return null;
    if (zhash in hashes) {
        const entry = hashes[zhash];
        const entryBits = entry[0].toString(2).padStart(22, '0');
        return {hashInt: entry[0], callsign: entry[1], hashBits: entryBits};
    }
    return null;
}

function addHashesFromInput(inputText) {
    input = inputText.toUpperCase();
    const pieces = input.split(/[\s;\.]+/);
    //const pieces = input.split(' ');
    //console.log("addHashesFromInput", input, pieces);

    for (const piece of pieces) {
        //ignore if only numbers
        if (/^\d+$/.test(piece)) continue;

        // add with and without /suffix
        addHash(piece);
        if (piece.includes('/')) addHash(piece.split('/')[0]);
    }
}
function addDefaultHashes() {
    const defaultHashes = ['', 'K1JT', 'K9AN', 'N0CALL', 'QU1RK', 'W1AW', 'CQ', 'VK3PGO', 'AA9GO', 'DEMO', 'D3MO', 'DEM0', 'D3M0', 'A1AAA', 'XX9XXX', 'EXAMPLE', 'CALLSIGN', 'CALLSIGN1', 'TEST', 'TEST1', 'TE1ST', 'TESTCALL', 'TESTCALL1', 'TEST1CALL', 'W3XYZ', 'K5ABC', 'VE3XXX', 'N1ZZZ', 'DL0ABC', 'VK2XYZ', 'ZL1AAA', 'JA1XXX', 'M0ABC', 'IT9XXX', 'ERROR', 'ERR0R','NUL', 'NULL', 'NIL', 'EMPTY'];
    for (const callsign of defaultHashes) {
        addHash(callsign);
    }
}
addDefaultHashes();


class FT8Message extends EventTarget {
    /**
     * 
     * @param {string} inputText 
     */
    constructor(inputText) {
      super();

      this.inputText = inputText;
      this.inputType = null; // can be manual set, otherwise auto-detected
      this.expectedResults = null; // if running test against known input. 

      // results of encoding
      this.encodeError = null;
      this.encodeError_ft8lib = null;
      //this.encodedData = null;
      this.symbolsText = null;
      this.packedData = null;

      this.reDecodedResult = null;

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

      this.hashes = hashes;

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
        const repaired = repairErrorsOnce(symbolsToBitsStrNoCosta(this.symbolsText), parityCheck);
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

    detectInputType() {
        this.inputType = doDetectInputType(this.inputText);
        return this.inputType;
    }

    encode() {

        let input = this.inputText;
        const inputType = this.inputType ?? this.detectInputType();

        //let packedData, symbolsText;

        switch (inputType) {
            case 'free text':
                input = normalizeBracketedFreeText(input);
                this.packedData = encodeFT8FreeText(input);
                break;
            case '79 symbols':
                input = normalizeSymbols(input);
                this.symbolsText = input;
                break;
            case '58 symbols':
                input = normalizeSymbols(input);
                this.symbolsText = symbols58ToSymbols79(input);
                break;
            case 'packed':
                input = normalizePackedData(input);
                this.packedData = new Uint8Array(input.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                break;
            case 'telemetry':
                input = normalizeTelemetry(input);
                let result = encodeFT8Telemetry(input);
                if (result.error) {
                    this.encodeError = result.error;
                    throw new Error(result.error);
                }
                this.packedData = new Uint8Array(result.result.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                break;
            case '77 bits':
                this.packedData = new bitsToPacked(input);
                break;
            case '82 bits':
                const bitStr = normalizeBinary(input);
                const zeroPadding = bitStr.slice(77);
                if (zeroPadding != '00000') {
                    this.encodeError = "Invalid 82-bit message: not zero padded. (Expected 77 bits + 5 zeros)";
                }
                this.packedData = bitsToPacked(bitStr);;
                break;
            case '91 bits':
                this.symbolsText = binary91ToSymbols(normalizeBinary(input));
                break;
            case '174 bits':
                this.symbolsText = binary174ToSymbols(normalizeBinary(input));
                break;
            case '237 bits': // symbols (as normal binary, including sync)
                this.symbolsText = binary237ToSymbols(normalizeBinary(input));
                break;
            case '237 grits': // symbols (as graycode bits, including sync)
                this.symbolsText = grayBitsToSymbols(input);
                break;
            case 'default':
            default:
                input = normalizeMessage(input);
                addHashesFromInput(this.inputText);

                const packingResult = messageToPackedData(input);

                if (packingResult.success) {
                    this.packedData = packingResult.data;
                    
                } else {
                    this.encodeError_ft8lib = `Encoding failed (code ${packingResult.errorCode}): ${packingResult.errorMessage}`;
                    console.log("falling back to free text because error: ", this.encodeError_ft8lib);
                    //this.encodeError = this.encodeError_ft8lib;

                    // attempt free text fallback
                    input = normalizeBracketedFreeText(input); // in case there's brackets
                    this.packedData = encodeFT8FreeText(input);

                    if (this.packedData == null) {
                        this.encodeError = "Failed to encode as free text";
                        throw new Error(this.encodeError);
                    }
                    //if failed will try to encode as free text
                }
                break;
        }

        if (this.symbolsText == null && this.packedData != null) {
            this.symbolsText = packedDataToSymbols(this.packedData);
        } else if (this.packedData == null && this.symbolsText != null) {
            //console.log("empty packed data, generating from symbols");
            this.packedData = symbolsToPackedData(this.symbolsText);
        }

        if (this.symbolsText == null) {
            this.encodeError = "Failed to generate symbols";
            throw new Error(this.encodeError);
        }

        if (this.packedData == null) {
            this.encodeError = "Failed to generate packed data";
            throw new Error(this.encodeError);
        }
    
        this.ft8MessageType = getFT8MessageType(this.packedData);
        this.reDecodedResult = decodeFT8PackedData(this.packedData, this.packedData.length);

        if (this.expectedResults) {
            if (this.expectedResults?.decoded) addHashesFromInput(this.expectedResults.decoded);
            if (this.expectedResults?.message) addHashesFromInput(this.expectedResults.message);
        }

    }

    setAudioOptions(sampleRate, baseFrequency, customToneFrequencies = null) {
        this.sampleRate = sampleRate;
        this.baseFrequency = baseFrequency;
        this.customToneFrequencies = customToneFrequencies;
    }

    
    clearAudioData() {
        this.audioSamples = null;
        this.dphiSamples = null;
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

        if (this.audioSamples == null) {
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
        // was generateAudioFromSymbols(symbols, options = {}) 
        const options = this.getOptions();
        if (this.symbolsText == null) return;

        const symbolsArray = symbolsToArray(this.symbolsText); // .split('').map(Number)

        const numSymbols = symbolsArray.length; // 79
        
        // Allocate memory for symbols
        const symbolsPtr = Module._malloc(numSymbols);
        Module.HEAPU8.set(symbolsArray, symbolsPtr);

        // Calculate number of samples
        let numSamples = Module._calculate_num_samples(numSymbols, options.symbolPeriod, options.sampleRate);

        // Allocate memory for audio and dphi
        const audioPtr = Module._malloc(numSamples * 4);
        const dphiPtr = Module._malloc(numSamples * 4);

        // Allocate memory for metadata
        const metadataLengthPtr = Module._malloc(4);
        const metadataJsonPtrPtr = Module._malloc(4);
        const FT8_TONE_COUNT = 8;

        let result;
        //options.customToneFrequencies = null; // test

        if (options.customToneFrequencies != null) {
            // Use custom tone frequencies
            const toneOffsetsPtr = Module._malloc(FT8_TONE_COUNT * 4);
            const toneOffsets = new Float32Array(Module.HEAPF32.buffer, toneOffsetsPtr, FT8_TONE_COUNT);
            for (let i = 0; i < FT8_TONE_COUNT; i++) {
                toneOffsets[i] = options.customToneFrequencies[i]; // - baseFrequency;
            }

            result = Module._synth_gfsk_custom(
                symbolsPtr, numSymbols, options.baseFrequency, toneOffsetsPtr,
                options.symbolBT, options.symbolPeriod, options.sampleRate,
                audioPtr, dphiPtr, metadataLengthPtr, metadataJsonPtrPtr
            );

            Module._free(toneOffsetsPtr);
        } else {
            // Use default FT8 frequencies
            result = Module._synth_gfsk(
                symbolsPtr, numSymbols, options.baseFrequency,
                options.symbolBT, options.symbolPeriod, options.sampleRate,
                audioPtr, dphiPtr, metadataLengthPtr, metadataJsonPtrPtr
            );
        }

        const audio = new Float32Array(Module.HEAPF32.buffer, audioPtr, numSamples);
        const dphi = new Float32Array(Module.HEAPF32.buffer, dphiPtr, numSamples);
        this.audioSamples = Array.from(audio);

        const dphiArray = Array.from(dphi);
        this.dphiSamples = scaleToRange(dphiArray, 190, 10); // fit in 0 to 200 (and flip) for visualization

        const metadataLength = Module.HEAP32[metadataLengthPtr / 4];
        const metadataJsonPtr = Module.HEAP32[metadataJsonPtrPtr / 4];
        const metadataStr = Module.UTF8ToString(metadataJsonPtr, metadataLength);
        //console.log(metadataStr);

        try {
            this.metadata = JSON.parse(metadataStr);
        } catch {
            error = "(internal error) Failed to parse metadata: '" + metadataStr + "'";
            console.error(error);
        } finally {
            // Free allocated memory
            Module._free(symbolsPtr);
            Module._free(audioPtr);
            Module._free(dphiPtr);
            Module._free(metadataLengthPtr);
            Module._free(metadataJsonPtrPtr);
            Module._free(metadataJsonPtr);
        }
    }
  }
  
function detectTelemetry(str) {
    //exactly 18 hex digits, or start with T:
    //note: first digit must be 0-8 if 18 digits. (not checked here)
    const trimmed = str.trim().toUpperCase();
    return (/^([0-9A-Fa-f][\s\-\:]?){18}$/.test(trimmed)) 
//                || (/^[Tt](ELEMETRY)?:\s0*([0-9A-Fa-f][\s\-\:]?){1,18}$/.test(trimmed))
          || (/^[Tt](ELEMETRY)?\s*:/.test(trimmed))
          || (/\#T(ELEMETRY)?$/.test(trimmed))
}

function detectFreeTextBrackets(str) {
    const trimmed = str.trim();
    return (trimmed.startsWith('<') && trimmed.endsWith('>'));
}

function normalizeMessage(message) {
    return message.trim().toUpperCase().replace(/\s+/g, ' ');
}

function normalizeMessageAndHashes(message) {
    // replace contents of <...> with '<...>'
    return message.trim().toUpperCase().replace(/\s+/g, ' ').replace(/<[^>]*>/g, '<...>');
}

function normalizeBracketedFreeText(input) {
    return input.trim().replace(/^<|>$/g, '');
}

function normalizeSymbols(input) {
    // numbers only
    return input.replace(/[-\s]/g, '');
}

function normalizeBinary(input) {
    // 0 and 1 only
    return input.replace(/[-\s]/g, '');
}

function normalizePackedData(input) {
    //return input.replace(/[-\s]/g, '').toUpperCase();
    return input.replace(/[-\s]/g, '').toLowerCase();
}

function normalizeTelemetry(str) {
    //exactly 18 hex digits, or start with T:
    //note: first digit must be 0-8 if 18 digits. (not checked here)
    
    let trimmed = str.trim();
    trimmed = trimmed.toUpperCase()
        .replace(/^[Tt](ELEMETRY)?:\s*/g, '') // remove initial "T:" or telemetry:
        .replace(/\#T(ELEMETRY)?\s*$/g, '') // remove "#TELEMETRY "
        .replace(/[ \-\:]/g, '') // remove any space - :
        .replace(/^[0]*/g, ''); // initial 0's
    return trimmed;
}

function doDetectInputType(inputOriginal) {
    const input = inputOriginal.trim();

    if (detectFreeTextBrackets(input)) {
        return 'free text'; // TODO: explicit free text vs assumed free text
    }

    if (/^[0-7]{79}$/.test(normalizeSymbols(input))) {
        return '79 symbols';
    }

    if (/^[0-7]{58}$/.test(normalizeSymbols(input))) {
        return '58 symbols';
    }

    // Check if input is hex string (packed data); pairs of hex must be together.
    if (/^\s*([0-9A-Fa-f]{2}[-\s]?){10}\s*$/.test(input)) {
        return 'packed';
    }

    if (detectTelemetry(input)) {
        return 'telemetry';
    }

    const normBinary = normalizeBinary(input);
    if (/^[0-1]+$/.test(normBinary)) {
        if (normBinary.length === 77) {
            return '77 bits'; // Source-encoded message, 77 bits
        } else if (normBinary.length === 82) { // 77 bits + 5 bits zero padding
            return '82 bits'; 
        } else if (normBinary.length === 91) { // 77 + 14 bits
            return '91 bits';
        } else if (normBinary.length === 174) { // 77 + 14 + 83 bits
            return '174 bits'
        } else if (normBinary.length === 237) { // 77 + 14 + 83 + 21*3
            //const normBinary = '010001110000101100011';
            const grayCosta = "011001100000110101010";
            if (normBinary.startsWith(grayCosta) || normBinary.endsWith(grayCosta) || normBinary.slice(108, 129) == grayCosta) {
                return '237 grits';
            }
            return '237 bits'
        } else {
            //TODO: warning
        }
    } 

    // Otherwise, assume it's a message (or 'free text' if ft8_lib fails to encode it)
    return 'default';
}

/**
 * @param {Array} numbers - array of numbers to scale
 * @param {number} newMin - new minimum value of the scaled range
 * @param {number} newMax - new maximum value of the scaled range
 * @returns {Array} - The array of numbers scaled to the new range
 */
function scaleToRange(numbers, newMin, newMax) {
    const { min: originalMin, max: originalMax } = findMinAndMax(numbers);
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

const inputTypeDescriptions = {
    '77 bits': 'Payload data',
    '82 bits': 'Payload data + five zero bits padding',
    '91 bits': 'Payload + CRC',
    '174 bits': 'Payload + CRC + LDPC',
    '237 bits': 'All symbols mapped to regular binary tribbles',
    '237 grits': 'All symbols as graycode triplets',
    '58 symbols': 'FSK tone data without sync tones',
    '79 symbols': 'Full FSK tone data',
    'packed': 'Payload as hexadecimal (zero-extended)', // aka right padded with 0's
    'default': 'FT8 message text',
};