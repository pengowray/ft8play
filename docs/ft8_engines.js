// FT8 message encoders: WSJT-X (JS port), MSHV (wasm) and ft8_lib (wasm).
// Each one packs message text into 77 bits and unpacks 77 bits back into text.
// No DOM use, so this can be shared by other pages.

import FT8LIB from './ft8_ft8lib.js';
import MSHVFT8 from './mshv_ft8_wrap.js';
import * as hashmgr from './ft8_hashmgr.js';
import { wsjtxEncode, wsjtxDecode, WSJTX_VERSION } from './wsjtx/wsjtx_engine.js';
import { inputTypeDescriptions } from './ft8_extra.js';

export const ft8lib = new FT8LIB();
export const mshvft8 = new MSHVFT8(() => hashmgr.setMshvft8(mshvft8));

/**
 * Result of unpacking 77 bits. `result`/`resultText` are what the "Decode check" row shows.
 * @typedef {{success: boolean, decodedText: string|null, errorMessage: string|null, result: string, resultText: string}} DecodeResult
 */
export function decodeOk(text) {
    return { success: true, decodedText: text, errorMessage: null, result: 'ok', resultText: 'ok' };
}
export function decodeFailed(errorMessage) {
    return { success: false, decodedText: null, errorMessage, result: 'error', resultText: 'error' };
}

/**
 * Encoders in order of preference: the first one that decodes a message gives its
 * main decoded text, and its tab is picked first.
 *
 * encode(text) returns { bits } or { packedData }, plus anything the encoder wants to
 * report (kept as message.encodeInfo); it throws an Error with a message for the user.
 * decode({ bits, packedData }) returns a DecodeResult.
 */
export const ENCODERS = [
    {
        id: 'wsjtx',
        name: 'WSJT-X',
        weight: 10,
        description: `FT8 message text, packed by WSJT-X ${WSJTX_VERSION} code`,
        encode(text) {
            const r = wsjtxEncode(text);
            if (!r.success) {
                throw new Error(`WSJT-X ${WSJTX_VERSION} could not pack this message (it would show "*** bad message ***")`);
            }
            // sentText: the text genft8 reports as sent, as WSJT-X's ft8code shows it
            return { bits: r.c77, sentText: r.msgsent, uninitialised: r.uninitialised };
        },
        decode({ bits }) {
            // Shared receive-side state, which knows the calls seen so far.
            try {
                const r = wsjtxDecode(bits, 1);
                return r.success ? decodeOk(r.msg) : decodeFailed(r.msg || 'unpack77 failed');
            } catch (e) {
                return decodeFailed(e.message);
            }
        },
    },
    {
        id: 'mshv',
        name: 'MSHV',
        weight: 9,
        description: 'FT8 message text, packed by MSHV',
        encode(text) {
            const r = mshvft8.packMessage(text);
            if (r.errorCode != 0 || !r.message) {
                throw new Error(`MSHV could not pack this message (error code ${r.errorCode})`);
            }
            return { bits: r.message };
        },
        decode({ bits }) {
            const r = mshvft8.unpackMessage(bits);
            return (r != null && r.errorCode == 0) ? decodeOk(r.message) : decodeFailed(r?.message || `error code ${r?.errorCode}`);
        },
    },
    {
        id: 'ft8lib',
        name: 'ft8_lib',
        weight: 7,
        description: 'FT8 message text, packed by ft8_lib',
        encode(text) {
            const r = ft8lib.messageToPackedData(text);
            if (!r.success) {
                throw new Error(`Encoding failed (code ${r.errorCode}): ${r.errorMessage}`);
            }
            return { packedData: r.data };
        },
        decode({ packedData }) {
            const r = ft8lib.decodeFT8FromPackedData(packedData);
            return r.success ? decodeOk(r.decodedText) : decodeFailed(r.errorMessage);
        },
    },
];

export function encoderById(id) {
    return ENCODERS.find(e => e.id === id) ?? null;
}

// Message text input types are 'default/<encoder id>'.
export function encoderForInputType(inputType) {
    return inputType?.startsWith('default/') ? encoderById(inputType.slice('default/'.length)) : null;
}

/** Name and description of an input type, for tabs and the "Input type" row. */
export function inputTypeInfo(inputType) {
    const encoder = encoderForInputType(inputType);
    if (encoder) return { label: encoder.name, description: encoder.description };
    return { label: inputType, description: inputTypeDescriptions[inputType] };
}
