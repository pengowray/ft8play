// Connects the WSJT-X packjt77 port to FT8 Player.

import { PackJT77, fmtmsg, genft8Message, FortranRuntimeError } from './packjt77.js';

export const WSJTX_VERSION = '2.7.0';

// WSJT-X messages are character*37: longer text is cut, shorter text is padded with blanks.
function toMsg37(text) {
    return text.padEnd(37, ' ').slice(0, 37);
}

/**
 * Encode text exactly as WSJT-X's ft8code utility does: fmtmsg, then genft8
 * (pack77, then unpack77 with nrx=0 to get the text actually sent), starting
 * from empty hash tables. Only calls in the message itself are known.
 * `uninitialised` lists the places where WSJT-X read a variable it never set
 * (the port used 0 or blanks); real WSJT-X may produce different bits for these.
 * @returns {{c77: string, i3: number, n3: number, msgsent: string, success: boolean, uninitialised: string[]}}
 */
export function wsjtxEncode(text) {
    const state = new PackJT77();
    let r;
    try {
        r = genft8Message(state, fmtmsg(toMsg37(text)));
    } catch (e) {
        if (e instanceof FortranRuntimeError) {
            throw new Error(`WSJT-X ${WSJTX_VERSION} stops on this message with a Fortran runtime error, which ends the program. ${e.message}`);
        }
        throw e;
    }
    return { ...r, msgsent: r.msgsent.trimEnd(), uninitialised: [...state.lastUB] };
}

// Receive side: one long-lived WSJT-X state that knows every callsign FT8 Player
// has seen (ft8_hashmgr.js feeds it), like a WSJT-X that has heard those calls.
export const wsjtxRx = new PackJT77();

export function wsjtxSaveHashCall(call) {
    wsjtxRx.saveHashCall(toMsg37(call).slice(0, 13));
}

/**
 * Unpack 77 bits with WSJT-X's unpack77.
 * @param {string} c77 77 characters of '0'/'1'
 * @param {number} nrx 1 for a received message, 0 for one about to be sent
 */
export function wsjtxDecode(c77, nrx = 1) {
    const r = wsjtxRx.unpack77(c77, nrx);
    return { success: r.success, msg: r.msg.trimEnd() };
}
