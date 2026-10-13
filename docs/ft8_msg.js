// One FT8 message: its 77 bits, packed bytes and 79 symbols, how it was made
// (input type, encoder), every encoder's decode of it, and the sync/CRC/parity checks.
// No DOM or audio here; audio is in ft8_audio.js (message.audio, set by main.js).

import { checkSync, checkCRC, checkParity, symbolsToBitsStrNoCosta } from "./ft8_extra.js";
import * as extra from "./ft8_extra.js";
import { ft8lib, ENCODERS, encoderById, decodeOk } from "./ft8_engines.js";

class FT8Message {

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

    initMessage(text, encoderId) {
        // note: text assumed to be normalized and uppercase
        const encoder = encoderById(encoderId);
        if (encoder == null) {
            throw new Error("Unknown encoder or No encoder specified: '" + encoderId + "'");
        }
        const result = encoder.encode(text);
        this.encodedBy = encoder.id;
        this.encodeInfo = result;
        if (result.bits != null) {
            this.initBits(result.bits);
        } else {
            this.initPackedData(result.packedData);
        }
    }

    postInit() {
        // todo: separate checks and additions

        this.packetType ??= (this.ft8MessageType === 'spp') ? 'spp' : 'ft8';

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

        // Decode with every encoder. The encoder that made the message reports the
        // text it says it sent, when it has one (WSJT-X: the text ft8code shows).
        this.decodeResults = {};
        for (const encoder of ENCODERS) {
            const sent = (encoder.id === this.encodedBy) ? this.encodeInfo?.sentText : null;
            this.decodeResults[encoder.id] = (sent != null) ? decodeOk(sent) : encoder.decode(this);
        }
        const results = ENCODERS.map(e => this.decodeResults[e.id]);
        this.bestDecodedResult = results.find(r => r.success) ?? results[0];
    }

    bestDecodedResultFromExpected(expectedResults) {
        if (expectedResults == null) {
            this.bestDecodedResult = null;
            return;
        }
        
        if (!expectedResults.error) {
            this.bestDecodedResult = {success: true, resultText: expectedResults.message, result: expectedResults.message, decodedText: expectedResults.message };
        } else {
            this.bestDecodedResult = {success: false, error: true, result: 'error', resultText: 'error', errorMessage: 'Could not unpack in reference', decodedText: expectedResults.decoded };
            this.decodingError = expectedResults.decoded;

        }


        return null;
    }

    constructor(inputText, expectedResults = null) {

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

      // set by initMessage() when the message was made from text by an encoder
      this.encodedBy = null; // encoder id, see ft8_engines.js
      this.encodeInfo = null; // what the encoder returned, e.g. { bits, sentText, uninitialised }

      // results of decoding final packed message
      this.decodeResults = null; // { [encoder id]: DecodeResult }
      this.bestDecodedResult = null;

      this.tabs = null;

      // cached checks
      this.SyncCheck = null;
      this.CRCCheck = null;
      this.ParityCheck = null; // LDPC

      // MessageAudio (ft8_audio.js), when the page wants audio for this message
      this.audio = null;
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

    clearAllCached() {
        this.SyncCheck = null;
        this.CRCCheck = null;
        this.ParityCheck = null;
        this.audio?.clearAudioData();
        //TODO: clear everything generated by encode() except maybe symbols and packedData
    }
}

export { FT8Message };
