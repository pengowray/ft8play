// Reads an audio file (WAV, or anything the browser can decode) as mono samples at the
// decoder's sample rate. The browser does the format decoding and resampling.

/**
 * @param {File|Blob} file
 * @param {number} sampleRate e.g. 12000
 * @returns {Promise<{samples: Float32Array, seconds: number, originalRate: number}>}
 */
export async function readAudioFile(file, sampleRate) {
    const data = await file.arrayBuffer();
    // decodeAudioData resamples to the context's rate.
    const context = new OfflineAudioContext(1, 1, sampleRate);
    const buffer = await context.decodeAudioData(data);
    let samples = buffer.getChannelData(0);
    if (buffer.numberOfChannels > 1) {
        // Average the channels.
        const mixed = new Float32Array(buffer.length);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
            const ch = buffer.getChannelData(c);
            for (let i = 0; i < ch.length; i++) mixed[i] += ch[i] / buffer.numberOfChannels;
        }
        samples = mixed;
    }
    return { samples: new Float32Array(samples), seconds: buffer.duration, originalRate: buffer.sampleRate };
}
