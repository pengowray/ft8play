import { HamGridSquare } from './HamGridSquare.js'
import { findHash } from "./ft8_hashmgr.js";
import { getCty } from "./ctydata.js";
import { MAXGRID4, MAXGRID6, ARRL_SEC, STATES_PROVINCES } from './ft8_constants.js';
import { bitsToBigIntString } from './ft8_convert.js';
import { hashBitsPrettyZ32, hashBitsPretty, hashBitsTo22styleBase10, callsignToHashBits } from './ft8_hashcalc.js';

export function bitsToCall(bits) {
    return  bitsToCallDetails(bits);
    
    //const details = bitsToCallDetails(bits);
    //return `${details.callsign} (${details.type})`;
}

// Convert 28 bits to a callsign
export function bitsToCallDetails(bits, extraBit = "") {
    if (bits.length !== 28 && bits.length !== 29) throw new Error("Callsign must be 28 or 29 bits");

    const extraOn = (bits.length === 29 && bits[28] === '1');
    bits = bits.slice(0, 28);

    const n = parseInt(bits, 2);
    
    const NTOKENS = 2063592;  // Number of special tokens
    const MAX22 = 4194304;    // 2^22, maximum 22-bit hash value

    let result = {
        subtype: null,
        value: null,
        details: {}
    };

    if (extraOn) result.extra = extraBit; // TODO: add "/R" or "/P" etc to call if using 29 bits.

    if (n < NTOKENS) {
        result.subtype = 'special token';
        if (n === 0) {
            result.value = "DE";
        } else if (n === 1) {
            result.value = "QRZ";
        } else if (n === 2) {
            result.value = "CQ";
        } else if (n < 1003) {
            result.value = `CQ ${(n - 3).toString().padStart(3, '0')}`;
            result.details.number = n - 3;
        } else if (n < 532444) {
            let code = n - 1003;
            let call = "";
            for (let i = 0; i < 4; i++) {
                const charIndex = code % 27;
                call = (charIndex === 0 ? ' ' : String.fromCharCode(charIndex + 64)) + call;
                code = Math.floor(code / 27);
            }
            result.value = `CQ ${call.trim()}`;
            result.details.alphabeticCode = call.trim();
            result.subtype = 'directed CQ'
        } else {
            result.subtype = 'undefined';
            result.value = '';
        }
    }
    // Check for 22-bit hash
    else if (n < NTOKENS + MAX22) {
        result.subtype = 'hash22';
        //result.desc = 'Displayed in Z-Base32 encoding'
        const hashValue = n - NTOKENS;
        //result.details.hashValue = hashValue
        //result.callsign = "<...>";
        const subBits = hashValue.toString(2).padStart(22, '0');
        result.isHash = true;
        result.hashBits = subBits;
        result.hashLen = 22;
        result.value = hashBitsPrettyZ32(subBits); // for bit viz display
        result.rawAppend = `22-bit hash: ${hashBitsPretty(subBits)} (=${hashBitsTo22styleBase10(subBits)})`;

        const matchDetails = hashMatchDetails(subBits);
        if (matchDetails) result = {...result, ...matchDetails};

    }  else {
        // Standard callsign

        result.subtype = 'standard call';
        let c = n - NTOKENS - MAX22;

        const subBits = c.toString(2).padStart(22, '0');
        result.rawAppend = `22-bit call: ${subBits} (=${bitsToBigIntString(subBits)})`;

        // Decode last 3 characters (from right to left)
        let suffix = '';
        for (let i = 0; i < 3; i++) {
            const charCode = c % 27;
            suffix = (charCode === 0 ? '' : String.fromCharCode(charCode + 64)) + suffix;
            c = Math.floor(c / 27);
        }
        result.details.suffix = suffix;

        // Decode digit (always present)
        const digit = c % 10;
        result.details.digit = digit;
        c = Math.floor(c / 10);

        // Decode second character
        const secondChar = c % 36;
        result.details.secondChar = secondChar < 10 ? secondChar.toString() : String.fromCharCode(secondChar - 10 + 65);
        c = Math.floor(c / 36);

        // Decode first character (may be empty)
        const firstChar = c % 37;
        result.details.firstChar = firstChar === 0 ? '' : 
                                   (firstChar <= 10 ? (firstChar - 1).toString() : 
                                   String.fromCharCode(firstChar - 11 + 65));

        // Construct full callsign
        result.value = result.details.firstChar + result.details.secondChar + 
                          result.details.digit + result.details.suffix;

        // Handle special prefixes TODO check this is correct/real
        if (result.value.startsWith('3D0') && result.value.length > 4) {
            result.value = '3DA0' + result.value.slice(3);
            result.details.specialPrefix = '3DA0';
            result.subtype = 'special prefix callsign';

        } else if (result.value.startsWith('3X0') && result.value.length > 4) {
            result.value = 'Q' + result.value.slice(1);
            result.details.specialPrefix = 'Q';
            result.subtype = 'Q code / callsign';
        }

        const country = callsignToCountry(result.value);
        result.country = country;
        
        const hashBits = callsignToHashBits(result.value)
        result.hashBits = hashBits;
        result.hashLen = hashBits?.length; // 22
        result.isHash = false;

        result.callsign = result.value;
    }

    return result;
}

export function callsignToCountry(call) {
    return callsignToCountryDetails(call)?.country;
}

export function callsignToCountryDetails(call) {
    if (typeof getCty === 'undefined') return null;

    const cty = getCty();
    const countryDetails = cty.getCountryDetails(call);
    //console.log('countryDetails:', countryDetails);

    return countryDetails;
}

function hashMatchDetails(bits) {
    const match = findHash(bits);
    if (match) {
        let result = {};
        //result.isHash = true; // shouldn't be needed
        result.hashMatch = match;
        result.hashBits = match.hashBits // give full bits in case only had parital
        result.hashLen = bits.length; // should be done already by caller, but make sure it's set to original length for underlining
        result.actualHashBits = bits; // save old value

        result.callsign = match.callsign;
        if (match.callsign == '') result.unhashed = '(blank)';
        
        result.country = callsignToCountry(match.callsign);

        return result;
    }
    return null;
}

export function isGrid4(grid) {
    return grid.length === 4 &&
           grid[0] >= 'A' && grid[0] <= 'R' &&
           grid[1] >= 'A' && grid[1] <= 'R' &&
           grid[2] >= '0' && grid[2] <= '9' &&
           grid[3] >= '0' && grid[3] <= '9';
}

export function bitsToHash(bits) {

    const matchDetails = hashMatchDetails(bits) ?? {};

    // desc: 'Displayed in Z-Base32 encoding'
    //note: hashBits may be overriden by matchDetails.hashBits, which will have the full 22 bits if a match is found
    return { hashBits: bits, value: hashBitsPrettyZ32(bits), ...matchDetails, isHash: true, hashLen: bits.length, subtype:'hash' + bits.length };
}


// not used
export function grid4ToG15(input) {
    if (isGrid4(input) && input !== 'RR73') {
        let j1 = (input.charCodeAt(0) - 'A'.charCodeAt(0)) * 18 * 10 * 10;
        let j2 = (input.charCodeAt(1) - 'A'.charCodeAt(0)) * 10 * 10;
        let j3 = (input.charCodeAt(2) - '0'.charCodeAt(0)) * 10;
        let j4 = (input.charCodeAt(3) - '0'.charCodeAt(0));
        return j1 + j2 + j3 + j4;
    } else {
        let c1 = input[0];
        if (c1 !== '+' && c1 !== '-' && input !== 'RRR' && input !== 'RR73' && 
            input !== '73' && input.trim().length !== 0) {
            throw new Error('Invalid input');
        }
        
        let irpt;
        if (c1 === '+' || c1 === '-') {
            irpt = parseInt(input) + 35;
        } else if (input.trim().length === 0) {
            irpt = 1;
        } else if (input === 'RRR') {
            irpt = 2;
        } else if (input === 'RR73') {
            irpt = 3;
        } else if (input === '73') {
            irpt = 4;
        } else {
            throw new Error('Invalid input');
        }
        return MAXGRID4 + irpt;
    }
}

export function bitsToGrid4OrReportWithType(bits) {
    return bitsToGrid4OrReportDetails(bits);
    //const details = bitsToGrid4OrReportDetails(bits)
    //return `${details.result} (${details.type})`;
}

export function bitsToGrid4OrReport(bits) {
    return bitsToGrid4OrReportDetails(bits).result;
}

export function bitsToGrid4OrReportDetails(bits) {
    if (bits.length !== 15) throw new Error("Grid/Report must be 15 bits");
    
    const g15 = parseInt(bits, 2);
    
    if (g15 < MAXGRID4) {
        let j1 = Math.floor(g15 / 1800);
        let remainder = g15 % 1800;
        let j2 = Math.floor(remainder / 100);
        remainder = remainder % (100);
        let j3 = Math.floor(remainder / 10);
        let j4 = remainder % 10;

        let ret = { value: String.fromCharCode('A'.charCodeAt(0) + j1) +
               String.fromCharCode('A'.charCodeAt(0) + j2) +
               j3.toString() +
               j4.toString(), subtype: 'Maidenhead locator' };
        const latlon = HamGridSquare.latLonForGrid(ret.value);
        let desc = `latitude, longitude: ${latlon.lat}, ${latlon.lon}`;
        if (ret.value == 'RR73') {
            desc += "\n*RR73 is short for 'report received and best regards'. It can also be encoded with a special token, but here has been encoded as a location.";
            ret.subtype += '*';
        } else if (ret.value == 'RG58') {
            desc += "\nRG-58/U is a type of coaxial cable often used for low-power signal and RF connections."
        } else if (ret.value == 'FB73') {
            desc += "\nFB in amateur radio slang means 'fine business' or 'excellent', which combines with '73' for 'best regards'. FB73 is in Antarctica.";
            ret.subtype += '*';
        }
        return { ...ret, ...latlon, desc };
        
    } else {
        const irpt = g15 - MAXGRID4;
        const also = {rawAppend: `Overgrid: ${irpt}`};
        //if (irpt === 0) return { value: '', subtype: 'unknown / reserved', subtype: 'special token', ...also}; // TODO: official meaning? lib_ft8 packs -35 dB to this.
        if (irpt === 1) return { value: '', subtype: 'blank', ...also};
        if (irpt === 2) return { value: 'RRR', long: 'RRR (reception report received)', subtype: 'special token', desc: 'RRR is short for "reception report received"', ...also };
        if (irpt === 3) return { value: 'RR73', subtype: 'special token', desc: 'RR73 is short for "report received and best regards"', ...also };
        if (irpt === 4) return { value: '73', subtype: 'special token', desc: '73 is short for "best regards"', ...also };

        //let value = (irpt - 35);
        //if (value >= 50) value -= 101; // db over 50 is folded negative
        const value = (irpt >= 85) ? (irpt - 136) : (irpt - 35);

        // irpt 5 to 84: regular: -30 to 49 dB; (irpt-35 db)
        if (irpt >= 85) also.unhashed = 'low signal'; // -51 to -29 dB (irpt-136 db) -- if treated like regular, would be 50 to 72 dB
        if (irpt >= 106) also.unhashed = 'ambiguous'; // -30 to 49 dB again (irpt-136 db) -- if treated like regular, would be 73 to 150 dB
        if (irpt >= 207) also.unhashed = 'very high'; // 50 to 231 dB -- if treated like regular, would be 151 to 332 dB

        //return { value, subtype: 'signal report', units: 'dB', ...also };
        // in lib_ft8 -35 dB (irpt: 0) also works? probably a bug
        // in (lib_ft8 v2.00): .\gen_ft8.exe "AA9GO VK3PGO R-31" "temp.wav" wraps to give '73' special token 
        // way out of range: -32 gives 'RR73' special token // -62 gives RR73 maidenhead
        // [fixed in ft8play] in ft8code.exe "aa9go vk3pgo R-31" gives 70 dB; Raw value: 111111011111001 (=32505) irpt: 105 -- should give -31 dB; 

        // in ft8code (wsjtx), -35 dB gives (irpt: 101 or 66 dB) ft8code.exe "aa9go vk3pgo R-35" gives 66 dB

        //const minVal = -30; // only the lowest value before the smaller lowest values
        const minVal = -51;  // 50 - 101

         //332: Raw value: 111111111111111 (=32767) irpt: 367; TODO: check spec and implementations if this is allowed or if higher dB numbers reserved
         // 99 dB is highest you can enter with ft8_lib
        // .\gen_ft8.exe "AA9GO VK3PGO R+100" "temp.wav" gives 10 dB (additional characters are truncated); '999' -> 99 dB
        // unpacking with lib_ft8 gives odd output: R+332 becomes R+Q2
        // in ft8code (wsjtx), ".\ft8code.exe "aa9go vk3pgo R+333" gives "*** bad message ***"" (correctly)
        //322 example: 525a67b7104522bfffc8

        //const maxVal = 49; // ought to be the max
        //const maxVal = 332; // max if ignore the fold
        const maxVal = 231;
        
        return { ...signalReportDetails(value, minVal, maxVal), ...also };
    }
}

export function bitsToGrid6(bits) {
    if (bits.length !== 25) throw new Error("Grid6 must be 25 bits");

    let n = parseInt(bits, 2);
    if (n == MAXGRID6) {
         return { value: '', subtype: 'blank' };
    } else if (n > MAXGRID6) {
        return { value: n.toString(), subtype: 'unknown / reserved' };
    }

    let j1 = Math.floor(n / (18 * 10 * 10 * 24 * 24));
    n %= 18 * 10 * 10 * 24 * 24;
    
    let j2 = Math.floor(n / (10 * 10 * 24 * 24));
    n %= 10 * 10 * 24 * 24;
    
    let j3 = Math.floor(n / (10 * 24 * 24));
    n %= 10 * 24 * 24;
    
    let j4 = Math.floor(n / (24 * 24));
    n %= 24 * 24;
    
    let j5 = Math.floor(n / 24);
    let j6 = n % 24;

    if (j1 < 0 || j1 > 17 || j2 < 0 || j2 > 17 || 
        j3 < 0 || j3 > 9 || j4 < 0 || j4 > 9 ||
        j5 < 0 || j5 > 23 || j6 < 0 || j6 > 23) {
        return { value: 'INVALID', subtype: 'error' };
    }

    let grid6 = 
        String.fromCharCode('A'.charCodeAt(0) + j1) +
        String.fromCharCode('A'.charCodeAt(0) + j2) +
        j3.toString() + j4.toString() +
        String.fromCharCode('a'.charCodeAt(0) + j5) +
        String.fromCharCode('a'.charCodeAt(0) + j6);

    let ret = { 
        value: grid6,
        subtype: 'Maidenhead locator' 
    };

    if (typeof HamGridSquare !== 'undefined' && HamGridSquare.latLonForGrid) {
        const latlon = HamGridSquare.latLonForGrid(grid6);
        ret.lat = Number(latlon.lat.toFixed(4));
        ret.lon = Number(latlon.lon.toFixed(4));
        ret.desc = `latitude, longitude: ${ret.lat}, ${ret.lon}`;
    }

    return ret;
}

export function bitsToReport(bits) {
    // r5 Report: -30 to +32, even numbers only

    if (bits.length !== 5) throw new Error("Report must be 5 bits");
    const n = parseInt(bits, 2); // 0 to 31
    const value = ((n * 2) - 30);
    //return { value, subtype: 'signal report', units: 'dB' }; // desc: 'Possible values: –30 to +32 dB'
    return signalReportDetails(value, -30, 32);
}

export function signalReportDetails(dbValue, min = null, max = null) {

    function formatToSigFigs(num, sigFigs) {
        if (num === 0) return '0';
        const magnitude = Math.floor(Math.log10(Math.abs(num))) + 1;
        const scale = Math.pow(10, sigFigs - magnitude);
        if (num >= 1e21) { // For silly large numbers
            const magnitude = Math.floor(Math.log10(num));
            const rounded = Math.round(num / Math.pow(10, magnitude - sigFigs + 1)) * Math.pow(10, magnitude - sigFigs + 1);
            return rounded.toLocaleString('fullwide', {useGrouping: true});
        }

        return (Math.round(num * scale) / scale).toString();
    }

    function formatNumber(num, sigFigs) {
        if (num >= 1e6 || num <= 1e-4) {
            const exponent = Math.floor(Math.log10(num) / 3) * 3;
            const base = num / Math.pow(10, exponent);
            return `${formatToSigFigs(base, sigFigs)}×10<sup>${exponent}</sup>`;
        }
        return formatToSigFigs(num, sigFigs);
    }

    let note = '';
    if (min != null && dbValue == min) note = ', which is the minimum possible for this field';
    if (max != null && dbValue == max) note = ', which is the maximum possible for this field';

    let explain = ''
    if (dbValue < 0) {
        explain = `Signal is reported as ${Math.abs(dbValue)} dB below the noise floor${note}.`;
    } else if (dbValue == 0) {
        explain = `Signal is reported as being at the same level as the noise floor${note}.`;
    } else {
        explain = `Signal is reported as +${dbValue} dB above the noise floor${note}.`;
    }

    const powerRatio =  Math.pow(10, dbValue / 10); // calculatePowerRatioFromDb(dbValue);
    
    const ratioSignificantFigures = 2;
    const expSignificantFigures = 2;

    // Format the "x:1" or "1:y" ratio
    let formattedRatio;
    if (powerRatio >= 1) {
      formattedRatio = formatToSigFigs(powerRatio, ratioSignificantFigures) + ':1';
    } else {
      formattedRatio = '1:' + formatToSigFigs(1 / powerRatio, ratioSignificantFigures);
    }

    // Format the power ratio
    let formattedPowerRatio = formatNumber(powerRatio, expSignificantFigures);
    let orScientific = (dbValue < 0 || formattedPowerRatio.includes('<sup>')) ? ` or ${formattedPowerRatio}` : '';

    explain += ` Power ratio: <span title="${powerRatio}">${formattedRatio}${orScientific}</span>.`;

    explain += '<br>The Signal to Noise Ratio (SNR) quoted for amateur radio modes is traditionally based on a receiver bandwidth of 2500 Hz, a far wider noise bandwidth than is required to successfully demodulate and decode the message.';

    let subtype = 'signal report';

    if (dbValue == 73) {
        explain = "73 is short for 'best regards'. It can also be encoded with a special token, but here has been encoded as a signal report.<br>" 
            + explain;
        subtype += '*';

    } else if (dbValue == 88) {
        explain = "88 is short for 'love and kisses', and here has been encoded as a signal report.<br>" 
            + explain;
        subtype += '*';
    }

    return { 
        value: dbValue.toString(), 
        subtype,
        units: 'dB', 
        descNoEsc: explain 
    }
}

export function calculatePowerRatioFromDb(dbValue) {
    return Math.pow(10, dbValue / 10);
}

export function bitsToR2Details(bits) { 
    //TODO: if it's a CQ message, note that it's always blank for CQ
    if (bits == '00') return { 'value': '', 'subtype': 'blank', 'desc': 'Other possible values: RRR, RR73, 73' };
    return { value: bitsToR2(bits) };
}


export function bitsToR2(bits) { // aka bitsToRR73
    // 2 bits, 0 to 3
    if (bits.length !== 2) throw new Error("R2 must be 2 bits");
    //RRR, RR73, 73, or blank (but not in that order)
    
    if (bits === '00') return '';
    if (bits === '01') return 'RRR';
    if (bits === '10') return 'RR73';
    if (bits === '11') return '73';

    throw new Error("Invalid R2");
}

export function bitsToNonstandardCallDetails(bits, message) {
    const callsign = bitsToNonstandardCall(bits);
    const hashBits = callsignToHashBits(callsign);
    const country = callsignToCountry(callsign);

    return { 
        callsign, 
        value: callsign,
        subtype: 'non-standard callsign',
        hashBits,
        isHash: false,
        country,
    };
}


export function bitsToNonstandardCall(bits) {
    const c = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/';
    let n58 = BigInt('0b' + bits);
    let callsign = '';
  
    for (let i = 0; i < 11; i++) {
      let index = Number(n58 % 38n);
      callsign = c[index] + callsign;
      n58 = n58 / 38n;
    }
  
    return callsign.trim();
}

export function bitsToFieldDayClass(bits) {
    //k3 Field Day Class: A, B, ... F
    return String.fromCharCode('A'.charCodeAt(0) + parseInt(bits, 2));
}

export function bitsToARRLSection(bits) {
    if (bits.length !== 7) throw new Error("ARRL Section must be 7 bits");
    const n = parseInt(bits, 2);;
    if (n == 0) {
        return '';
    }
    
    const i = n-1;
    if (i < 0 || i >= ARRL_SEC.length) {
        //return "Invalid ARRL Section";
        return `Section ${n}`;
    }
    return ARRL_SEC[i];
}

export function bitsToSerialOrStateProvinces(bits) {
    //US States and Canadian Provinces
    if (bits.length !== 13) throw new Error("Serial or State/Province must be 13 bits");
    const n = parseInt(bits, 2);;
    if (n == 8000) {
        return { value: '', subtype: 'blank' };
    } else if (n < 8000) {
        return { value: n.toString(), subtype: 'serial number' };
    } else if (n <= 8000 + STATES_PROVINCES.length) {
        return { value: STATES_PROVINCES[n - 8001], subtype: 'state/province' };
    } else {
        return { value: n, subtype: 'undefined' };
    }
}


export function bitsToTxDetailsLow(bits) {
    // n4 Number of transmitters: 1-16
    if (bits.length !== 4) throw new Error("Tx Number must be 4 bits");
    const n = parseInt(bits, 2);
    const low = `${n + 1}`;
    return { value: low, subtype: 'transmitter(s)'};
}

export function bitsToTxDetailsHigh(bits) {
    // n4 Number of transmitters: 17-32
    if (bits.length !== 4) throw new Error("Tx Number must be 4 bits");
    const n = parseInt(bits, 2);
    const high = `${n + 17}`;
    return { value: high, subtype: 'transmitter(s)'};
}

export function bitsToTxDetails(bits) {
    // n4 Number of transmitters: 1-16, 17-32
    if (bits.length !== 4) throw new Error("Tx Number must be 4 bits");
    const n = parseInt(bits, 2);
    const low = `${n + 1}`;
    const high = `${n + 17}`;
    return { value: low, short: low, long: `${low} or ${high}`, subtype: 'transmitter(s)', desc: `This value may refer to ${low} or ${high} transmitter(s)` };
}

export function bitsToRST(bits) {
    //r3 Report: 2-9, displayed as 529 – 599 or 52 - 59
    if (bits.length !== 3) throw new Error("RST must be 3 bits");
    const n = parseInt(bits, 2) + 2;
    //return `5${n} or 5${n}9`;
    const low = `5${n}`;
    const high = `5${n}9`;
    return { value: high, short: low, long: `${low} or ${high}`, subtype:'RST', desc: `May refer to ${low} or ${high}` };

}
