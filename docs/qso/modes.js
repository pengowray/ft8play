// Timing and tone parameters for each digital mode. Code should read these rather than
// assume FT8's numbers, so other modes (e.g. JS8's four speeds) can be added here later.

export const MODES = {
    FT8: {
        id: 'FT8',
        slotSeconds: 15,        // length of one transmit/receive period
        symbolSeconds: 0.160,   // length of one tone
        toneSpacingHz: 6.25,
        numTones: 8,
        numSymbols: 79,
        txStartSeconds: 0.5,    // a signal with DT = 0 starts this long after the slot boundary
        sampleRate: 12000,      // audio rate the decoder works at
        decodeAtSeconds: 14.4,  // seconds into the slot when the slot's audio is decoded
    },
};

/** Duration of one transmission in seconds (12.64 s for FT8). */
export function txDurationSeconds(mode) {
    return mode.numSymbols * mode.symbolSeconds;
}
