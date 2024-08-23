/* ft8_lib wrappers */

function messageToPackedData(message) {
    const resultPtr = Module.ccall('encodeFT8Message', 'number', ['string'], [message]);
    if (resultPtr === 0) {
        return {
            success: false,
            errorCode: -1,
            errorMessage: "Failed to allocate memory for result"
        };
    }

    const result = {
        data: Module.getValue(resultPtr, '*'),
        size: Module.getValue(resultPtr + 4, 'i32'),
        errorCode: Module.getValue(resultPtr + 8, 'i32'),
        errorMessage: Module.getValue(resultPtr + 12, '*')
    };

    let returnObject;

    if (result.errorCode !== 0) {
        returnObject = {
            success: false,
            errorCode: result.errorCode,
            errorMessage: Module.UTF8ToString(result.errorMessage)
        };
    } else {
        const packedData = new Uint8Array(Module.HEAPU8.buffer, result.data, result.size);
        returnObject = {
            success: true,
            data: new Uint8Array(packedData)
        };
    }

    Module.ccall('freeFT8EncodeResult', 'void', ['number'], [resultPtr]);
    
    return returnObject;
}

function packedDataToSymbolsArray(packedData) {
    const symbolsPtr = Module.ccall('packedToSymbols', 'number', ['array'], [packedData]);
    const symbols = new Uint8Array(Module.HEAPU8.buffer, symbolsPtr, FT8_NN);
    const result = new Uint8Array(symbols);
    Module._free(symbolsPtr);
    //return result;
    return arrayToSymbols(result);
}

//not used (but probably should be kept, but untested)
function symbolsToAudio(symbols, baseFreq, sampleRate) {
    const symbolArray = symbolsToArray(symbols);
    const resultPtr = Module.ccall('symbolsToAudio', 'number', ['array', 'number', 'number'], [symbolArray, baseFreq, sampleRate]);
    const result = {
        symbols: new Uint8Array(Module.HEAPU8.buffer, Module.getValue(resultPtr + 8, '*'), FT8_NN),
        audio: new Float32Array(Module.HEAPF32.buffer, Module.getValue(resultPtr + 16, '*'), Module.getValue(resultPtr + 20, 'i32')),
        dphi: new Float32Array(Module.HEAPF32.buffer, Module.getValue(resultPtr + 24, '*'), Module.getValue(resultPtr + 20, 'i32')),
        metadata: Module.UTF8ToString(Module.getValue(resultPtr + 32, '*')),
        metadata_length: Module.getValue(resultPtr + 36, 'i32')
    };
    Module._free(resultPtr);
    return result;
}

function decodeFT8FromPackedData(packedData) {
    const packedDataArray = new Uint8Array(packedData);
    const packedDataPtr = Module._malloc(packedDataArray.length);
    Module.HEAPU8.set(packedDataArray, packedDataPtr);
    
    const resultPtr = Module.ccall('decodeFT8PackedData', 'number', ['number', 'number'], [packedDataPtr, packedDataArray.length]);
    
    Module._free(packedDataPtr);
    
    if (resultPtr === 0) {
        return {
            success: false,
            result: 'error',
            errorCode: -1,
            errorMessage: "Failed to allocate memory for result"
        };
    }

    const result = {
        decodedText: Module.UTF8ToString(Module.getValue(resultPtr, '*')),
        errorCode: Module.getValue(resultPtr + 4, 'i32'),
        errorMessage: Module.UTF8ToString(Module.getValue(resultPtr + 8, '*'))
    };

    Module.ccall('freeFT8DecodeResult', 'void', ['number'], [resultPtr]);
    
    return {
        success: result.errorCode === 0,
        result: result.errorCode === 0 ? 'ok' : 'error',
        resultText: result.errorCode === 0 ? 'ok' : 'error (' + result.errorCode + ')',
        decodedText: result.decodedText,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
    };
};

function freeFT8Result() {
    console.log("freeFT8Result");
    Module.cwrap('freeFT8Result', null, ['number']);
}

function doFreeFT8Result() {
    console.log("do freeFT8Result");
    Module.cwrap('freeFT8Result', null, ['number']);
}
