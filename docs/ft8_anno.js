import { getFT8MessageTypeName, bitsToBigIntString, bitsToText, bitsToCall, bitsToHash, bitsToReport, bitsToGrid4OrReportWithType, bitsToTxDetailsLow, bitsToFieldDayClass, bitsToARRLSection, bitsToTxDetailsHigh, telemetryBitsToText, telemetryByteAnnotations, bitsToRST, bitsToNonstandardCallDetails, bitsToR2 } from './ft8_extra.js';

export const def_i3n3 = { label: "Message Type", shortLabel:'type', tag:'i3.n3', start: 71, length: 6, getValue: bitsToi3n3 };
export const def_i3 = { label: "Message type", shortLabel:'i3', tag:'i3', start: 74, length: 3, getValue: bitsToi3 };

// note: don't use shortLabel if not needed to display on tribble bit display

export const annotationDefinitions = {
    "this is text": [],
    "0.0": [ // Free text
        { label: "Free text", tag:'f71', start: 0, length: 71, getValue: bitsToText },
        def_i3n3
    ],
    "0.1": [
        { label: "Call A", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Call B", tag:'c28', start: 28, length: 28, getValue: bitsToCall },
        { label: "Hash", tag:'h10', start: 56, length: 10, getValue: bitsToHash },
        { label: "Report",  tag:'r5', start: 66, length: 5, getValue: bitsToReport },
        def_i3n3
    ],
    "0.2": [ //(is this anything?)
        def_i3n3
    ],
    "0.3": [ // ARRL Field Day
        { label: "Call A", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Call B", tag:'c28', start: 28, length: 28, getValue: bitsToCall },
        { label: "/R", shortLabel: 'R', tag:'R1', start: 56, length: 1, getValue: callsignModFlagR },
        { label: "No. of transmitters", tag:'n4', shortLabel: 'nTX', tag:'n4', start: 57, length: 4, getValue: bitsToTxDetailsLow },
        { label: "Class", tag:'k3', start: 61, length: 3, getValue: bitsToFieldDayClass },
        { label: "Section",tag: 'S7', start: 64, length: 7, getValue: bitsToARRLSection },
        def_i3n3
    ],
    "0.4": [ // ARRL Field Day (alternate format)
        //n4 Number of transmitters: 1-16, 17-32
        //S7 ARRL/RAC Section
        { label: "Call A", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Call B", tag:'c28', start: 28, length: 28, getValue: bitsToCall },
        { label: "R", tag:'R1', start: 56, length: 1, getValue: rReportFlag},
        { label: "No. of transmitters", shortLabel: 'nTX', tag:'n4', start: 57, length: 4, getValue: bitsToTxDetailsHigh },
        { label: "Class",  tag:'k3', start: 61, length: 3, getValue: bitsToFieldDayClass },
        { label: "Section", tag: 'S7', start: 64, length: 7, getValue: bitsToARRLSection },
        def_i3n3
    ],
    "0.5": [ // Telemetry
        { label: "Telemetry", tag: 't71', start: 0, length: 71, getValue: telemetryBitsToText, subdefs: telemetryByteAnnotations() },
        def_i3n3
    ],
    "wspr1": [ // WSPR type 1
        { label: "Call", tag:'n28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Grid", tag:'b15', start: 28, length: 15, getValue: bitsToGrid4OrReportWithType },
        { label: 'Power', tag: 'b5', start: 43, length: 5, getValue: wsprPower }, // 7 bits for power level? (wikipedia)
        { label: 'WSRP type', tag: 'j2', start: 48, length: 2, getValue: wsprType },
        def_i3n3
    ],
    "wspr2": [ // WSPR type 2
        { label: "Call", tag:'n28', start: 0, length: 28, getValue: bitsToCall },
        { label: "npfx", tag:'b16', start: 28, length: 16, getValue: placeholder }, // crpt?
        { label: 'Power', tag: 'b5', start: 44, length: 5, getValue: wsprPower },
        { label: 'WSRP type', tag: 'j1', start: 49, length: 1, getValue: wsprType },
        def_i3n3
    ],
    "wspr3": [ // WSPR type 3
        { label: "Call", tag:'b22', start: 0, length: 22, getValue: placeholder },
        { label: "Grid6", tag:'b25', start: 22, length: 25, getValue: bitsToGrid6 },
        { label: 'WSRP type', tag: 'j3', start: 47, length: 3, getValue: wsprType },
        def_i3n3
    ],
    "0.6": [
        def_i3n3
    ],
    "0.7": [ // undefined
        def_i3n3
    ],
    "1": [ // Standard message
        { label: "Call A", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "/R", shortLabel:'r', tag:'r1a', start: 28, length: 1, getValue: callsignModFlagR },
        { label: "Call B", tag:'c28', start: 29, length: 28, getValue: bitsToCall },
        { label: "/R", shortLabel:'r',  tag:'r1b', start: 57, length: 1, getValue: callsignModFlagR },
        { shortLabel: 'R', tag:'R1', start: 58, length: 1, getValue: rReportFlag },
        { label: "Grid/Report", tag:'g15', start: 59, length: 15, getValue: bitsToGrid4OrReportWithType },
        def_i3
    ],
    "2": [ // EU VHF Contest c28 p1 c28 p1 R1 g15
        { label: "Call A", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "/P", shortLabel:'p', tag:'p1a', start: 28, length: 1, getValue: callsignModFlagP },
        { label: "Call B", tag:'c28', start: 29, length: 28, getValue: bitsToCall },
        { label: "/P", shortLabel:'p', tag:'p1b', start: 57, length: 1, getValue: callsignModFlagP },
        { shortLabel: 'R', tag:'R1', start: 58, length: 1, getValue: rReportFlag},
        { label: "Grid4", tag:'g15', start: 59, length: 15, getValue: bitsToGrid4OrReportWithType },
        def_i3
    ],
    "3": [ // ARRL RTTY Roundup t1 c28 c28 R1 r3 s13
        { label: "TU", shortLabel:'T', tag:'t1', start: 0, length: 1, getValue: tuFlag },
        { label: "Call A", tag:'c28', start: 1, length: 28, getValue: bitsToCall },
        { label: "Call B", tag:'c28', start: 29, length: 28, getValue: bitsToCall },
        { label: "R", tag:'R1', start: 57, length: 1, getValue: rReportFlag},
        { label: "Report", shortLabel:"RST", tag:'r3', start: 58, length: 3, getValue: bitsToRST },
        { label: "Serial/State", tag:'s13', start: 61, length: 13, getValue: bitsToSerialOrState },
        def_i3
    ],
    "4": [ // Non-standard call: h12 c58 h1 r2 c1
        { label: "Hash", tag:'h12', start: 0, length: 12, getValue: bitsToHash },
        { label: "Call", tag:'c58', start: 12, length: 58, getValue: bitsToNonstandardCallDetails },
        { label: "Sender field", shortLabel: "h", tag: 'h1', start: 70, length: 1, getValue: callOrderFlag },
        { label: "Signoff", tag:'r2', start: 71, length: 2, getValue: bitsToR2 },
        { label: "CQ", tag:'c1', start: 73, length: 1, getValue: (bit) => bit === '1' ? '1 (First callsign is CQ. Ignore hash)' : '0' },
        def_i3
    ],
    "5": [ // EU VHF Contest with 6-digit grid locator
        { label: "Hash A", tag:'h12', start: 0, length: 12, getValue: bitsToHash },
        { label: "Hash B", tag:'h22', start: 12, length: 22, getValue: bitsToHash },
        { label: "R", tag:'R1', start: 34, length: 1, getValue: rReportFlag},
        { label: "Report", shortLabel:"RST", tag:'r3', start: 35, length: 3, getValue: bitsToRST },
        { label: "Serial", tag:'s11', desc: 'Serial number (0-2047)', start: 38, length: 11, getValue: bitsToSerial },
        { label: "Grid6", tag:'g25', start: 49, length: 25, getValue: bitsToGrid6 },
        def_i3
    ],
    "6": [ // undefined
        def_i3
    ],
    "7": [ // undefined
        def_i3
    ],
    "spp": [
        { label: "Packet Version Number", shortLabel: 'PVN', tag: 'PVN', start: 0, length: 3, getValue: sppVersionNumber },

        { label: 'Packet Type', shortLabel: 'T', tag:'', start: 3, length: 1, getValue: sppPacketTypeFlag },
        { label: 'Secondary Header', shortLabel: 'S', tag: 'Flag', start: 4, length: 1, getValue: sppSecondaryHeaderFlag }, // Secondary Header Flag
        { label: 'Application Process Identifier', shortLabel: "APID", tag: 'APID', start: 5, length: 11, getValue: sppAPID },

        { label: 'Sequence Flags', shortLabel: 'SF', tag: '', start: 16, length: 2, getValue: sppSequenceFlags },
        { label: 'Sequence Count or Name', shortLabel: 'Sequence / Name', tag: '', start: 18, length: 14, getValue: sppSequenceCountOrName }, // Packet Sequence Count/Packet Name

        { label: 'Data Length', shortLabel: 'Length', tag: '', start: 32, length: 16, getValue: sppDataLength }, // Packet Data Length (Octets - 1)

        // Packet Secondary Header
        //Time Code Field and/or Ancillary Data Field (unknown length)
        //{ label: 'Time Code', tag: 'TCF', start: 48, length: 16, getValue: placeholder }, // Time Code Field
        { label: 'Ancillary Data / Time Code', tag: '', start: 48, length: 32, getValue: placeholder }, // Ancillary Data
        //  see: ECSS-E-ST-70-41C and 301x0b4e1.pdf
        //PACKET DATA FIELD
    ]

};

export function AnnotationDefGetValueText(annotation, payloadBits77) {
    const bits = payloadBits77.slice(annotation.start, annotation.start + annotation.length);
    return annotation.getValue(bits, payloadBits77);
}

export function AnnotationDefGetAnnotation(annotation, payloadBits77) {
    const bits = payloadBits77.slice(annotation.start, annotation.start + annotation.length);
    var value = annotation.getValue(bits, payloadBits77);
    var rawIntValue = bitsToBigIntString(bits);
    if (typeof value === 'object') {
        return { ...annotation, ...value, bits, rawIntValue };
    } else if (typeof value === 'string') {
        return { ...annotation, value, bits, rawIntValue };
    }
}

function bitToFlag(bit, on, off) {
    //TODO: return details including on and off values for description/diagram
    return bit === '1' ? on : off;
}

function callOrderFlag(bit) {
    //TODO: formatting like the field labels

    //sender field is:
    return {isFlag: true, value: bit, off: 'Call (c58)', on: 'Hash (h12)' }

    //Hash is:
    //return {isFlag: true, value: bit, off: 'first callsign', on: 'second callsign' }
}

const nada = ""; // "—"; // em dash
function rReportFlag(bit) {
    //return bit === '1' ? 'R' : '0';
    if (bit === '1') {
        //TODO: underline R in R-10
        return {isFlag: true, value: bit, on: 'R', off: nada, desc: "R at start of signal report"  }; // (add: meaning roger or received?
    } else {
        return {isFlag: true, value: bit, on: 'R', off: nada }; //  desc: "Nothing at start of report or not a signal report"
    }
}

function tuFlag(bit) {
    //return bit === '1' ? {value: 'TU', desc: "Thank you"}: '0' 
    if (bit === '1') {
        return {isFlag: true, value: bit, on: 'TU', off: nada, desc: 'Thank you'  }
    } else {
        return {isFlag: true, value: bit, on: 'TU', off: nada }
    }
}

function wsprPower(bits) {
    const val = parseInt(bits, 2);
    const dBm = Math.round(val*10.0/3.0);
    const isValid = dBm >= 0 && dBm <= 60;
    const subtype = isValid ? null : 'out of range';
    return { value: dBm, units: 'dBm', subtype, desc: 'Transmitter power level' };
}

function wsprType(bits) {
    if (bits === '1') {
        return { value: '2', units: 'WSPR type', rawAppend: '' };
    } else if (bits === '00') {
        return { value: '1', units: 'WSPR type' };
    } else if (bits === '010') {
        return { value: '3', units: 'WSPR type' };
    }
    return { value: bits, units: 'binary', subtype: 'Error', desc: 'Not a WSPR type' };
}

function sppVersionNumber(bits) {
    if (bits === '000') {
        return { value: bits, units: 'binary', subtype: 'Space Packet Protocol: Version 1 CCSDS Packet', desc: 'As recommended in SPACE PACKET PROTOCOL, CCSDS 133.0-B-2, Blue Book, June 2020, Recommended Standard, Issue 2. Recommendation for Space Data System Standards by the Consultative Committee for Space Data Systems (CCSDS).'};
    } else {
        return { value: bits, units: 'binary', subtype: 'Reserved', desc: 'Version number reserved for the possibility of introducing other packet structures.' };
    }
}
function sppPacketTypeFlag(bit) {
    if (bit === '0') {
        return {isFlag: true, value: bit, on: 'telecommand', off: 'telemetry', desc: "Telemetry (or reporting) Packet. The exact definition of ‘telemetry Packets’ and ‘telecommand Packets’ needs to be established by the project that uses this protocol." }
    } else {
        return {isFlag: true, value: bit, on: 'telecommand', off: 'telemetry', desc: "Telecommand (or requesting) Packet. The exact definition of ‘telemetry Packets’ and ‘telecommand Packets’ needs to be established by the project that uses this protocol." }
    }
}

function sppSecondaryHeaderFlag(bit) {
    return {isFlag: true, value: bit, on: 'present', off: 'not present' }
}

function sppAPID(bits, allBits) {
    const value = parseInt(bits, 2).toString();

    if (bits === '11111111111') {
        return { value, subtype: 'Idle Packet', desc: 'Idle Packets are generated when needed, by the Telemetry (TM), Advanced Orbiting Systems (AOS), and USLP (Unified Space Link Protocol) Space Data Link Protocols, to maintain synchronization of the data transport processes.' };
    }

    const isTelemetry = (allBits && allBits.length >= 5 && allBits[3] == '0');
    const subtype = isTelemetry ? 'source' : 'destination';
    return { value, units: 'APID', subtype, desc: 'APID is used to identify the on-board application process that is the destination for a request and the source for a report' } ;
}

function sppSequenceFlags(bits) {
    if (bits == '00') {
        return { value: bits, subtype: 'Continuation segment', desc: 'the Space Packet contains a continuation segment of User Data' };
    } else if (bits == '01') {
        return { value: bits, subtype: 'First segment', desc: 'the Space Packet contains the first segment of User Data' };
    } else if (bits == '10') {
        return { value: bits, subtype: 'Last segment', desc: 'the Space Packet contains the last segment of User Data' };
    } else if (bits == '11') {
        return { value: bits, subtype: 'Single segment', desc: 'the Space Packet contains the complete User Data' };
    }

    return { value: bits, subtype: 'Error' };
}

function sppSequenceCountOrName(bits, allBits) {
    const value = parseInt(bits, 2).toString();
    if (allBits && allBits.length >= 5 && allBits[3] == '0') {// telemetry Packet)
        return { value, subtype: 'Sequence Count', desc: 'For telemetry packets, this field contains a Packet Sequence Count.' };
    } else {
        return { value, subtype: 'Sequence Count or Name', desc: 'For telecommand packets, this field contains either the Packet Sequence Count or Packet Name.' };
    }
}

function sppDataLength(bits) {
    return { value: (parseInt(bits, 2) + 1).toString(), units: 'octets' };
}

function callsignModFlagR(bit) {
    return callsignModFlagX(bit, '/R');
}

function callsignModFlagP(bit) {
    return callsignModFlagX(bit, '/P');
}

function callsignModFlagX(bit, flag) {
    //return bit === '1' ? '/R' : '0';
    if (bit === '1') {
        //TODO: include whole callsign/X, underline /X, and include hash too
        return {isFlag: true, value: bit, on: flag, off: nada, onGravity: 'high', desc: `${flag} call sign modifier`  }; // (add: meaning roger or received?
    } else {
        return {isFlag: true, value: bit, on: flag, off: nada }; //  desc: "Nothing at start of report or not a signal report"
    }
}

function bitsToi3n3(bits) {
    if (bits.length !== 6) return placeholder(bits);

    const n3 = parseInt(bits.slice(0, 3), 2);
    const i3 = parseInt(bits.slice(3, 6), 2);
    const short = `${i3}.${n3}`;
    const subtype = getFT8MessageTypeName(short);
    const long = `${short} (${subtype})`;
    return {short, value:short, long, subtype};
}
function bitsToi3(bits) {
    if (bits.length !== 3) return placeholder(bits);

    const short = parseInt(bits, 2).toString();
    const subtype = getFT8MessageTypeName(short);
    const long = `${short} (${subtype})`;
    return {short, value:short, long, subtype};
}


//Placeholder for TODOs
function placeholder(bits) {
    const veryShort = parseInt(bits, 2).toString();
    const long = `${veryShort} (undefined value)`;
    const short = veryShort + "*";
    const desc = 'No definition available for this data type. Integer value is shown.';

    return {short, long, veryShort, desc, value: veryShort, units: '*', subtype: 'Not yet supported field type'};
}

//Placeholder for TODOs
function placeholderText(bits) {
    //return `${parseInt(bits, 2).toString()} (undecoded value)`;
    return `${bitsToBigIntString(bits).toString()} (undecoded value)`;
    
}

//TODO
function bitsToGrid6(bits) {
    return placeholder(bits);
}

//TODO
function bitsToSerialOrState(bits) {
    return placeholder(bits);
}

function bitsToSerial(bits) {
    return {value: bitsToBigIntString(bits).toString() };
}

export * from './ft8_anno.js';