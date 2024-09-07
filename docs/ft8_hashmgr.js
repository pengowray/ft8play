import { hashCallsign, hashBitsToZ32Dense } from "./ft8_extra.js";
//import * as extra from "./ft8_extra.js";

export const hashes = {};

export let mshvft8 = null;
export function setMshvft8(mshvft8_) {
    mshvft8 = mshvft8_;
}

export function addHash(callsign) {
    //TODO: watch for conflicts
    //TODO: priorty levels
    if (callsign == null) return;
    addDefaultHashes();
    
    callsign = callsign.toUpperCase().trim();
    if (callsign == '') return;

    if (callsign.startsWith('<') && callsign.endsWith('>')) {
        callsign = callsign.slice(1, -1).trim();
        if (callsign == '' || callsign == '...') return; // note: '.' is not a valid character
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

        if (mshvft8 !== null) {
            mshvft8.saveHash(callsign);
        }
    }
}

export function findHash(bits) {
    //todo: accept int too; use: callsignToHashBits(hashInt)

    addDefaultHashes();

    const zhash = hashBitsToZ32Dense(bits);
    if (zhash == null || zhash == '') return null;
    if (zhash in hashes) {
        const entry = hashes[zhash];
        const entryBits = entry[0].toString(2).padStart(22, '0');
        return {hashInt: entry[0], callsign: entry[1], hashBits: entryBits};
    }
    return null;
}

export function addHashesFromInput(inputText) {
    const input = inputText.toUpperCase();
    const pieces = input.split(/[\s;\.]+/);
    //const pieces = input.split(' ');
    //console.log("addHashesFromInput", input, pieces);

    for (const piece of pieces) {
        
         //ignore if only numbers (e.g. for symbols or bits)
         //todo: add but low priority
        if (/^\d+$/.test(piece)) continue;

        //remove surrounding < > or quotes
        if (piece.startsWith('<') && piece.endsWith('>')) {
            addHash(piece.slice(1, -1));
        } else if (piece.startsWith('"') && piece.endsWith('"')) {
            addHash(piece.slice(1, -1));
        } else if (piece.startsWith("'") && piece.endsWith("'")) {
            addHash(piece.slice(1, -1));
        } else {
            addHash(piece);
        }
        
        // add with and without /suffix
        addHash(piece);
        if (piece.includes('/')) addHash(piece.split('/')[0]);
    }
}

let defaultsAdded = false;
export const defaultHashes = ['', 'K1JT', 'K9AN', 'N0CALL', 'QU1RK', 'W1AW', 'CQ', 'VK3PGO', 'AA9GO', 'DEMO', 'D3MO', 'DEM0', 'D3M0', 'A1AAA', 'XX9XXX', 'EXAMPLE', 'CALLSIGN', 'CALLSIGN1', 'TEST', 'TEST1', 'TE1ST', 'TE0ST', 'TESTCALL', 'TESTCALL1', 'TEST1CALL', 'W3XYZ', 'K5ABC', 'VE3XXX', 'N1ZZZ', 'DL0ABC', 'VK2XYZ', 'ZL1AAA', 'JA1XXX', 'M0ABC', 'IT9XXX', 'ERROR', 'ERR0R', 'NONE', 'N0NE', 'NUL', 'NULL', 'NIL', 'EMPTY', 'F0X', 'FOX', 'SUPERFOX', 'SUP3RFOX', 'SUPERF0X' ];
function addDefaultHashes() {
    defaultsAdded = true; // set this early to stop recursion
    if (defaultsAdded) return;
    for (const callsign of defaultHashes) {
        addHash(callsign);
    }
}

