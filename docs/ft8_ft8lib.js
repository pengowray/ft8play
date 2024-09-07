import {arrayToSymbols, symbolsToArray} from './ft8_extra.js';
import create_ft8lib_module from './ft8lib/ft8_wasm.js';

export const FT8_NN = 79; // Total channel symbols

class FT8Lib {
  constructor(readyCallback) {
    create_ft8lib_module({
      locateFile: function(path, prefix) {
        if (path.endsWith('.wasm')) return './ft8lib/' + path;
        return prefix + path;
      }
    }).then(module => {
        this.module = module;
        this.initializeFunctions();
        if (readyCallback) readyCallback();
    });
  }

  initializeFunctions() {
    this.encodeFT8Message = this.module.cwrap('encodeFT8Message', 'number', ['string']);
    this.freeFT8EncodeResult = this.module.cwrap('freeFT8EncodeResult', 'void', ['number']);
    this.packedToSymbols = this.module.cwrap('packedToSymbols', 'number', ['array']);
    this.symbolsToAudio = this.module.cwrap('symbolsToAudio', 'number', ['array', 'number', 'number']);
    this.decodeFT8PackedData = this.module.cwrap('decodeFT8PackedData', 'number', ['number', 'number']);
    this.freeFT8DecodeResult = this.module.cwrap('freeFT8DecodeResult', 'void', ['number']);
  }

  messageToPackedData(message) {
    if (!this.module) throw new Error("Module not initialized");
    const resultPtr = this.encodeFT8Message(message);
    if (resultPtr === 0) {
      return {
        success: false,
        errorCode: -1,
        errorMessage: "Failed to allocate memory for result"
      };
    }

    const result = {
      data: this.module.getValue(resultPtr, '*'),
      size: this.module.getValue(resultPtr + 4, 'i32'),
      errorCode: this.module.getValue(resultPtr + 8, 'i32'),
      errorMessage: this.module.getValue(resultPtr + 12, '*')
    };

    let returnObject;

    if (result.errorCode !== 0) {
      returnObject = {
        success: false,
        errorCode: result.errorCode,
        errorMessage: this.module.UTF8ToString(result.errorMessage)
      };
    } else {
      const packedData = new Uint8Array(this.module.HEAPU8.buffer, result.data, result.size);
      returnObject = {
        success: true,
        data: new Uint8Array(packedData)
      };
    }

    this.freeFT8EncodeResult(resultPtr);
    return returnObject;
  }

  packedDataToSymbols(packedData) {
    if (!this.module) throw new Error("Module not initialized");
    const symbolsPtr = this.packedToSymbols(packedData);
    const symbols = new Uint8Array(this.module.HEAPU8.buffer, symbolsPtr, FT8_NN);
    const result = new Uint8Array(symbols);
    this.module._free(symbolsPtr);
    
    const symbolstext =  arrayToSymbols(result);
    return symbolstext;
  }

  symbolsToAudio(symbols, baseFreq, sampleRate) {
    if (!this.module) throw new Error("Module not initialized");
    const symbolArray = symbolsToArray(symbols);
    const resultPtr = this.symbolsToAudio(symbolArray, baseFreq, sampleRate);
    const result = {
      symbols: new Uint8Array(this.module.HEAPU8.buffer, this.module.getValue(resultPtr + 8, '*'), FT8_NN),
      audio: new Float32Array(this.module.HEAPF32.buffer, this.module.getValue(resultPtr + 16, '*'), this.module.getValue(resultPtr + 20, 'i32')),
      dphi: new Float32Array(this.module.HEAPF32.buffer, this.module.getValue(resultPtr + 24, '*'), this.module.getValue(resultPtr + 20, 'i32')),
      metadata: this.module.UTF8ToString(this.module.getValue(resultPtr + 32, '*')),
      metadata_length: this.module.getValue(resultPtr + 36, 'i32')
    };
    this.module._free(resultPtr);
    return result;
  }

  decodeFT8FromPackedData(packedData) {
    if (!this.module) throw new Error("Module not initialized");
    const packedDataArray = new Uint8Array(packedData);
    const packedDataPtr = this.module._malloc(packedDataArray.length);
    this.module.HEAPU8.set(packedDataArray, packedDataPtr);
    
    const resultPtr = this.decodeFT8PackedData(packedDataPtr, packedDataArray.length);
    
    this.module._free(packedDataPtr);
    
    if (resultPtr === 0) {
      return {
        success: false,
        result: 'error',
        errorCode: -1,
        errorMessage: "Failed to allocate memory for result"
      };
    }

    const result = {
      decodedText: this.module.UTF8ToString(this.module.getValue(resultPtr, '*')),
      errorCode: this.module.getValue(resultPtr + 4, 'i32'),
      errorMessage: this.module.UTF8ToString(this.module.getValue(resultPtr + 8, '*'))
    };

    this.freeFT8DecodeResult(resultPtr);
    
    return {
      success: result.errorCode === 0,
      result: result.errorCode === 0 ? 'ok' : 'error',
      resultText: result.errorCode === 0 ? 'ok' : 'error (' + result.errorCode + ')',
      decodedText: result.decodedText,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage
    };
  }
}

export default FT8Lib;