const encodeFT8_packed = Module.cwrap('encodeFT8_packed', 'string', ['string']);
const encodeFT8_audio = Module.cwrap('encodeFT8_audio', 'number', ['string', 'number']);
const encodeFT8_full = Module.cwrap('encodeFT8_full', 'string', ['string']);

function encodeMessage() {
    const message = document.getElementById('message-input').value;
    
    // Get packed bytes and tones
    const packedResult = encodeFT8_packed(message);
    console.log(packedResult);
    
    // Get audio samples
    const numSamplesPtr = Module._malloc(4);
    const audioPtr = encodeFT8_audio(message, numSamplesPtr);
    const numSamples = Module.getValue(numSamplesPtr, 'i32');
    const audioArray = new Float32Array(Module.HEAPF32.buffer, audioPtr, numSamples);
    console.log('First 10 audio samples:', audioArray.slice(0, 10));
    
    // Clean up
    Module._free(numSamplesPtr);
    Module._free(audioPtr);
    
    // Get full result
    const fullResult = encodeFT8_full(message);
    console.log(fullResult);
}
