const def_i3n3 = { label: "Message Type", tag:'i3.n3', start: 71, length: 6, getValue: bitsToi3n3 };
const def_i3 = { label: "Message type", shortLabel:'i3', tag:'i3', start: 74, length: 3, getValue: bitsToi3 };

// note: don't use shortLabel if not needed to display on tribble bit display

const annotationDefinitions = {
    "0.0": [ // Free text
        { label: "Free text", tag:'f71', start: 0, length: 71, getValue: bitsToText },
        def_i3n3
    ],
    "0.1": [
        { label: "Call1", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Call2", tag:'c28', start: 28, length: 28, getValue: bitsToCall },
        { label: "Hash", tag:'h10', start: 56, length: 10, getValue: bitsToHash },
        { label: "Report",  tag:'r5', start: 66, length: 5, getValue: bitsToReport },
        def_i3n3
    ],
    "0.2": [ //(is this anything?)
        def_i3n3
    ],
    "0.3": [ // ARRL Field Day
        { label: "Call1", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Call2", tag:'c28', start: 28, length: 28, getValue: bitsToCall },
        { label: "/R", shortLabel: 'R', tag:'R1', start: 56, length: 1, getValue: (bit) => bit === '1' ? 'R' : '' },
        { label: "Number of transmitters", tag:'n4', shortLabel: 'nTX', tag:'n4', start: 57, length: 4, getValue: bitsToTxDetails },
        { label: "Class", tag:'k3', start: 61, length: 3, getValue: bitsToFieldDayClass },
        { label: "Section",tag: 'S7', start: 64, length: 7, getValue: bitsToARRLSection },
        def_i3n3
    ],
    "0.4": [ // ARRL Field Day (alternate format)
        //n4 Number of transmitters: 1-16, 17-32
        //S7 ARRL/RAC Section
        { label: "Call1", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Call2", tag:'c28', start: 28, length: 28, getValue: bitsToCall },
        { label: "R", tag:'R1', start: 56, length: 1, getValue: (bit) => bit === '1' ? 'R' : '' },
        { label: "Number of transmitters", shortLabel: 'nTX', tag:'n4', start: 57, length: 4, getValue: bitsToTxDetails },
        { label: "Class",  tag:'k3', start: 61, length: 3, getValue: (bits) => bitsToFieldDayClass(bits) },
        { label: "Section", tag: 'S7', start: 64, length: 7, getValue: (bits) => bitsToARRLSection(bits) },
        def_i3n3
    ],
    "0.5": [ // Telemetry
        { label: "Telemetry", tag: 't71', start: 0, length: 71, getValue: (bits) => telemetryBitsToText(bits) },
        def_i3n3
    ],
    "0.6": [ // undefined
        def_i3n3
    ],
    "0.7": [ // undefined
        def_i3n3
    ],

    "1": [ // Standard message
        { label: "Call1", tag:'c28', start: 0, length: 28, getValue: bitsToCall },
        { label: "Call1/R", shortLabel:'r', tag:'r1', start: 28, length: 1, getValue: (bit) => bit === '1' ? '1 /R' : '0' },
        { label: "Call2", tag:'c28', start: 29, length: 28, getValue: bitsToCall },
        { label: "Call2/R", shortLabel:'r',  tag:'r1', start: 57, length: 1, getValue: (bit) => bit === '1' ? '1 /R' : '0' },
        { shortLabel: 'R', tag:'R1', start: 58, length: 1, getValue: (bit) => bit === '1' ? '1 R' : '0' },
        { label: "Grid/Report", tag:'g15', start: 59, length: 15, getValue: bitsToGrid4OrReportWithType },
        def_i3
    ],
    "2": [ // EU VHF Contest c28 p1 c28 p1 R1 g15
        { label: "Call1", tag:'c28', start: 0, length: 28, getValue: (bits) => bitsToCall(bits) },
        { label: "Call1/P", shortLabel:'p', tag:'p1', start: 28, length: 1, getValue: (bit) => bit === '1' ? '/P' : '' },
        { label: "Call2", tag:'c28', start: 29, length: 28, getValue: (bits) => bitsToCall(bits) },
        { label: "Call2/P", shortLabel:'p', tag:'p1', start: 57, length: 1, getValue: (bit) => bit === '1' ? '/P' : '' },
        { shortLabel: 'R', tag:'R1', start: 58, length: 1, getValue: (bit) => bit === '1' ? 'R' : '' },
        { label: "Grid4", tag:'g15', start: 59, length: 15, getValue: (bits) => bitsToGrid4OrReportWithType(bits) },
        def_i3
    ],
    "3": [ // ARRL RTTY Roundup t1 c28 c28 R1 r3 s13
        { label: "TU", shortLabel:'T', tag:'t1', start: 0, length: 1, getValue: (bit) => bit === '1' ? '1 TU' : '0' },
        { label: "Call1", tag:'c28', start: 1, length: 28, getValue: (bits) => bitsToCall(bits) },
        { label: "Call2", tag:'c28', start: 29, length: 28, getValue: (bits) => bitsToCall(bits) },
        { label: "R", tag:'R1', start: 57, length: 1, getValue: (bit) => bit === '1' ? 'R' : '' },
        { label: "Report", shortLabel:"RST", tag:'r3', start: 58, length: 3, getValue: bitsToRST },
        { label: "Serial/State", tag:'s13', start: 61, length: 13, getValue: bitsToSerialOrState },
        def_i3
    ],
    "4": [ // Non-standard call: h12 c58 h1 r2 c1
        { label: "Hash", tag:'h12', start: 0, length: 12, getValue: bitsToHash },
        { label: "Call", tag:'c58', start: 12, length: 58, getValue: bitsToNonstandardCallDetails },
        { label: "Call order", shortLabel: "h", tag: 'h1', start: 70, length: 1, getValue: (bit) => bit === '1' ? '1 (Hash is second callsign)' : '0 (Hash is first callsign)' },
        { label: "Signoff", tag:'r2', start: 71, length: 2, getValue: bitsToR2 },
        { label: "CQ", tag:'c1', start: 73, length: 1, getValue: (bit) => bit === '1' ? '1 (First callsign is CQ. Ignore hash)' : '0' },
        def_i3
    ],
    "5": [ // EU VHF Contest with 6-digit grid locator
        { label: "Hash1", tag:'h12', start: 0, length: 12, getValue: bitsToHash },
        { label: "Hash2", tag:'h22', start: 12, length: 22, getValue: bitsToHash },
        { label: "R", tag:'R1', start: 34, length: 1, getValue: (bit) => bit === '1 R' ? 'R' : '0' },
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
    ]

};

function AnnotationDefGetValueText(annotation, payloadBits77) {
    const bits = payloadBits77.slice(annotation.start, annotation.start + annotation.length);
    return annotation.getValue(bits);
}

function bitToFlag(bit, on, off) {
    //TODO: return details including on and off values for description/diagram
    return bit === '1' ? on : off;
}

function AnnotationDefGetAnnotation(annotation, payloadBits77) {
    const bits = payloadBits77.slice(annotation.start, annotation.start + annotation.length);
    var value = annotation.getValue(bits);
    var rawIntValue = bitsToBigIntString(bits);
    if (typeof value === 'object') {
        return { ...annotation, ...value, bits, rawIntValue };
    } else if (typeof value === 'string') {
        return { ...annotation, value, bits, rawIntValue };
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
