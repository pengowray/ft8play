import { bitsToHex } from './ft8_convert.js';

 // z-base-32: permutation of the RFC3548 standard.
export const ZBASE32 = 'ybndrfg8ejkmcpqxot1uwisza345h769';
export const ZBASE32_Reverse = {};
for (let i = 0; i < ZBASE32.length; i++) {
    ZBASE32_Reverse[ZBASE32[i]] = i;
}

export function bitsToZBase32(bits) {
    if (bits.length % 5 !== 0) {
        throw new Error("Invalid length");
    }
    let result = "";
    for (let i = 0; i < bits.length; i += 5) {
        const chunk = bits.slice(i, i + 5);
        result += ZBASE32[parseInt(chunk, 2)];
    }
    return result;
}

export function hashBitsToZ32Dense(bits) { 
    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }

    // 22 bit: aabcc
    // 12 bit: aab
    // 10 bit: aa
    const len = bits.length;
    if (len == 22) {
        return `${bitsToZBase32(bits.slice(0, 10))}${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}${bitsToZBase32(bits.slice(12, 22))}`;
    } else if (len == 12) {
        return `${bitsToZBase32(bits.slice(0, 10))}${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}`;
    } else if (len == 10) {
        return `${bitsToZBase32(bits.slice(0, 10))}`;
    } else if (len == 0) {
        return "";
    } else {
        throw new Error("Invalid length: " + len + " in '" + bits + "'");
    }
}

export function hashBitsPrettyZ32(bits) {
    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }

    // 22 bit: aa-b-cc
    // 12 bit: aa-b-00
    // 10 bit: aa-0-00
    const len = bits.length;
    if (len == 22) {
        return `${bitsToZBase32(bits.slice(0, 10))}-${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}-${bitsToZBase32(bits.slice(12, 22))}`;
    } else if (len == 12) {
        return `${bitsToZBase32(bits.slice(0, 10))}-${bitsToZBase32(bits.slice(10, 12).padStart(5, '0'))}-00`;
    } else if (len == 10) {
        return `${bitsToZBase32(bits.slice(0, 10))}-0-00`;
    } else if (len == 0) {
        return "00-0-00";
    } else {
        throw new Error("Invalid length: " + len + " in '" + bits + "'");
    }
}


function hashBitsPrettyHex(bits) {
    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }

    // 22 bit: aaa-b-ccc
    // 12 bit: aaa-b-xxx
    // 10 bit: aaa-x-xxx
    const len = bits.length;
    if (len == 22) {
        return `${bitsToHex(bits.slice(0, 10).padStart(12, '0'))}-${bitsToHex(bits.slice(10, 12).padStart(4, '0'))}-${bitsToHex(bits.slice(12, 22).padStart(12, '0'))}`;
    } else if (len == 12) {
        //return `xxx-${bitsToHex(bits.slice(0, 2).padStart(4, '0'))}-${bitsToHex(bits.slice(2, 10).padStart(12, '0'))}`;
        return `${bitsToHex(bits.slice(0, 10).padStart(12, '0'))}-${bitsToHex(bits.slice(10, 12).padStart(4, '0'))}-xxx`;
    } else if (len == 10) {
        //return `xxx-x-${bitsToHex(bits)}`;
        return `${bitsToHex(bits.slice(0, 10).padStart(12, '0'))}-x-xxx`;
    } else {
        throw new Error("Invalid length: " + len + " in '" + bits + "'");
    }
}

export function hashBitsPretty(bits) {
    // 10, 12, or 22 bits

    // 0000000000 11 0000000000

    const len = bits.length;
    if (len == 22) {
        return `${bits.slice(0, 10)} ${bits.slice(10, 12)} ${bits.slice(12, 22)}`;
    } else if (len == 12) {
        return `${bits.slice(0, 10)} ${bits.slice(10, 12)} xxxxxxxxxx`;

    } else if (len == 10) {
        return `${bits.slice(0, 10)} xx xxxxxxxxxx`;
    }

    // other length/error
    return bits;
}

export function hashBitsTo22styleBase10(bits) {
    // 22-bit hash in the style of hash22calc.exe (WSJT-X)
    // decimal value of the 22-bit hash, padded to 7 digits
    // does not make sense to use for 10 or 12-bit hashes

    if (typeof bits === 'number') { // accept numbers too
        return bits.toString().padStart(7, '0');
    }

    if (bits.match(/[^01]/)) {
        throw new Error("Invalid characters");
    }
    if (bits.length != 22) {
        throw new Error("Invalid length: " + bits.length + " in '" + bits + "'");
    }

    return parseInt(bits, 2).toString().padStart(7, '0');
}

export function hashCallsign(callsign) {
    const FT8_CHAR_TABLE_ALPHANUM_SPACE_SLASH = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/";

    let n58 = BigInt(0);
    const maxLength = Math.min(callsign.length, 11);

    for (let i = 0; i < maxLength; i++) {        
        const j = FT8_CHAR_TABLE_ALPHANUM_SPACE_SLASH.indexOf(callsign[i]);
        if (j < 0) {
            //console.error("Invalid character in callsign for hashing: " + callsign[i]);
            return null; // hash error (wrong character set)
        }
        n58 = (BigInt(38) * n58) + BigInt(j);
    }

    // Pretend to have trailing whitespace
    for (let i = maxLength; i < 11; i++) {
        n58 = BigInt(38) * n58;
    }

    const multiplier = BigInt("47055833459");
    const n22 = Number((multiplier * n58) >> BigInt(42) & BigInt(0x3FFFFF));

    return n22;
}

export function callsignToHashBits(bits) {
    return hashCallsign(bits).toString(2).padStart(22, '0');
}

export function addUnderlineToHash(hashBits, numBitsToUnderline, classname = "call-highlighter") {
    if (hashBits == null || hashBits.length == 0) return '';

    const zhash = hashBitsPrettyZ32(hashBits);
    if (numBitsToUnderline == null ||  numBitsToUnderline == 0) return zhash;

    let bitLen = numBitsToUnderline ?? hashBits?.length ?? 0;
    let uLen = zhash.length;
    //if (bitLen == 22) underlineLen = 6;
    if (bitLen == 12) uLen = 4;
    if (bitLen == 10) uLen = 2;

    return addSpanToStart(zhash, uLen, classname);
}

//utility for underlining text
function addSpanToStart(str, charCount, classname) {
    if (charCount <= 0) {
      return str;
    }

    const len = charCount > str.lengt ? str.length : charCount;
    
    const spanContent = str.slice(0, len);
    const remainder = str.slice(len);
    
    return `<span class="${classname}">${spanContent}</span>${remainder}`;
  }
  
//export * from './ft8_extra.js';
