// Plain-English explanation of an FT8 message, built from its parts (see ft8_parts.js),
// so it follows the message type and field values rather than guessing from the text.

import { parseMessageParts } from './ft8_parts.js';

const CQ_MEANINGS = {
    DX: 'stations far away (usually on other continents)',
    NA: 'North America', SA: 'South America', EU: 'Europe', AS: 'Asia', AF: 'Africa', OC: 'Oceania',
    POTA: 'Parks on the Air', SOTA: 'Summits on the Air', WWFF: 'World Wide Flora and Fauna',
    TEST: 'a contest', FD: 'ARRL Field Day', RU: 'ARRL RTTY Roundup',
};

const FD_CLASSES = {
    A: 'club or group portable station',
    B: 'portable station of 1 or 2 people',
    C: 'mobile',
    D: 'home station on commercial power',
    E: 'home station on emergency power',
    F: 'emergency operations centre',
};

const CQ = 'a general call to any station';
const R_OPENER = 'With R (short for "Roger"), ';
const NONSTD = 'a nonstandard callsign (longer than 6 characters, or with a prefix)';

const gridSentence = (who, grid) => `${who}'s approximate location is grid square ${grid} (a Maidenhead locator).`;
const reportSentence = (from, to) => `The report is the signal-to-noise ratio of ${to}'s signal, as measured by ${from}.`;
const serialSentence = (from) => `The serial number is the number of this contact in ${from}'s contest log.`;

/**
 * @param {string} bits 77 message bits
 * @param {string|null} text decoded text (WSJT-X's, when available), or null if decoding failed
 * @returns {string} explanation, or '' when there is nothing useful to say
 */
export function explainFT8Message(bits, text) {
    const p = parseMessageParts(bits, text ?? '');
    if (!p) return '';
    if (p.kind === 'undefined') {
        return `Message type ${p.type} is not defined in WSJT-X 2.7.0, so this message's bits cannot be decoded into text.`;
    }
    if (text == null) return '';

    const out = [];
    switch (p.kind) {
        case 'cq': explainCQ(p, out); break;
        case 'qrz':
            out.push(`${p.from.text} is sending QRZ, which means "Who is calling me?"`);
            if (p.tail === 'grid') out.push(gridSentence(p.from.text, p.grid));
            break;
        case 'de':
            out.push(`This message is from ${p.from.text} and is not addressed to any particular station. DE means "from".`);
            if (p.tail === 'grid') out.push(gridSentence(p.from.text, p.grid));
            break;
        case 'standard': explainStandard(p, out); break;
        case 'nonstd': explainNonstandard(p, out); break;
        case 'nonstd-cq':
            out.push(`${p.from.text} is calling CQ, ${CQ}. ${p.from.text} is ${NONSTD}, so this CQ message has no room for a grid square.`);
            break;
        case 'dxpedition': {
            const { fox, done, next } = p;
            out.push(`${fox.text} is a DXpedition station (the Fox), sending one message to two of the stations calling it (the Hounds). ${fox.text} sends RR73 to tell ${done.text} that the contact between ${fox.text} and ${done.text} is complete. ${fox.text} also sends ${next.text} a signal report of ${p.report} dB to start a contact with ${next.text}.`);
            break;
        }
        case 'field-day': explainFieldDay(p, out); break;
        case 'rtty-roundup': explainRttyRoundup(p, out); break;
        case 'eu-vhf': explainEuVhf(p, out); break;
        case 'free-text':
            out.push(`This message is free text: "${p.freeText}". Free text is up to 13 characters long. It can use letters A to Z, digits 0 to 9, spaces, and the symbols plus (+), minus (-), period (.), slash (/) and question mark (?).`);
            if (p.freeText.length === 13) out.push('The text is 13 characters long, which is the maximum for free text.');
            break;
        case 'telemetry':
            if (p.hex) {
                out.push(`This is a telemetry message: 71 bits of data, shown as the hexadecimal digits ${p.hex}.`);
            } else {
                out.push('This is a telemetry message, and all 71 bits of data are 0.');
            }
            out.push('FT8 does not define what telemetry data means, so the sender and receiver agree on the meaning themselves.');
            break;
        case 'wspr': explainWspr(p, out); break;
        default: return '';
    }

    addCallNotes(p, out);
    return out.join(' ');
}

function explainCQ(p, out) {
    const from = p.from.text;
    if (!p.cqMod) {
        out.push(`${from} is calling CQ, ${CQ}.`);
    } else if (p.cqModIsNumber) {
        out.push(`${from} is calling CQ, ${CQ}. The number ${p.cqMod} is the kHz part of the frequency where ${from} will listen for replies (for example, 290 means 50.290 MHz on the 6 m band).`);
    } else {
        const meaning = CQ_MEANINGS[p.cqMod];
        out.push(meaning
            ? `${from} is calling CQ ${p.cqMod}, where ${p.cqMod} means ${meaning}.`
            : `${from} is calling CQ ${p.cqMod}.`);
        out.push('Callers add a word after CQ to say which stations, or which activity, the call is for.');
    }
    if (p.tail === 'grid') out.push(gridSentence(from, p.grid));
}

function explainStandard(p, out) {
    const to = p.to.text, from = p.from.text;
    switch (p.tail) {
        case 'none':
            out.push(`${from} is calling ${to}. In a message with two callsigns, the first callsign is the station being called and the second callsign is the station sending the message.`);
            break;
        case 'grid':
            out.push(`${from} is calling ${to} and sending a grid square. ${gridSentence(from, p.grid)} This message is usually a reply to a CQ call from ${to}.`);
            break;
        case 'R-grid':
            out.push(`${R_OPENER}${from} confirms receiving ${to}'s message and sends ${to} a grid square. ${gridSentence(from, p.grid)} This message is used in contests where stations exchange grid squares.`);
            break;
        case 'report':
            out.push(`${from} is sending ${to} a signal report of ${p.report} dB. ${reportSentence(from, to)}`);
            break;
        case 'R-report':
            out.push(`${R_OPENER}${from} confirms receiving ${to}'s signal report and sends ${to} a signal report of ${p.report} dB. ${reportSentence(from, to)}`);
            break;
        case 'RRR':
            out.push(`${from} sends ${to} RRR ("Roger Roger Roger"), confirming that ${from} received ${to}'s message. ${to} usually replies with 73 ("best regards") to end the contact (QSO).`);
            break;
        case 'RR73':
            out.push(`${from} sends ${to} RR73, which means "Roger Roger" (received) plus 73 ("best regards"). ${from} considers the contact (QSO) complete. ${to} usually replies with a final 73.`);
            if (p.rr73AsGrid) {
                out.push('In this message, RR73 is sent as the grid square RR73, as WSJT-X does. RR73 is a real grid square near the North Pole, but FT8 programs read this grid square as the RR73 sign-off ("Roger Roger" plus 73), not as a location. Some other programs, such as ft8_lib, send RR73 as a special code.');
            }
            break;
        case '73':
            out.push(`${from} is signing off to ${to} with 73, which means "best regards". 73 is usually the last message of a contact (QSO).`);
            break;
    }
}

function explainNonstandard(p, out) {
    const to = p.to.text, from = p.from.text;
    if (!to || !from) return;
    switch (p.signoff) {
        case 'RRR': explainStandard({ ...p, tail: 'RRR' }, out); break;
        case 'RR73': explainStandard({ ...p, tail: 'RR73' }, out); break;
        case '73': explainStandard({ ...p, tail: '73' }, out); break;
        default: explainStandard({ ...p, tail: 'none' }, out);
    }
    const full = p.hashedRole === 'to' ? from : to;
    out.push(`${full} is ${NONSTD}. A nonstandard callsign takes up 58 of the message's 77 bits, so this message sends ${full} in full and the other callsign as a hashed callsign (a short code).`);
}

function explainFieldDay(p, out) {
    const to = p.to.text, from = p.from.text;
    const classMeaning = FD_CLASSES[p.fdClass];
    const transmitters = `${p.ntx} transmitter${p.ntx === 1 ? '' : 's'}`;
    const exchange = `${transmitters}, class ${p.fdClass}${classMeaning ? ` (${classMeaning})` : ''}, and section ${p.section}`;
    out.push(p.r
        ? `${R_OPENER}${from} confirms receiving ${to}'s ARRL Field Day exchange and sends its own exchange: ${exchange}.`
        : `${from} sends ${to} the ARRL Field Day exchange: ${exchange}.`);
    out.push(p.section === 'DX'
        ? `Section DX means ${from} is outside the US and Canada.`
        : `The section is ${from}'s ARRL or RAC section, a region of the US or Canada.`);
}

function explainRttyRoundup(p, out) {
    const to = p.to.text, from = p.from.text;
    const rst = `a signal report of ${p.rst} in RST format (readability, strength, tone)`;
    if (p.state) {
        out.push(`${from} sends ${to} the ARRL RTTY Roundup exchange: ${rst}, and ${from}'s state or province, ${p.state}.`);
    } else {
        out.push(`${from} sends ${to} the ARRL RTTY Roundup exchange: ${rst}, and serial number ${p.serial}. Stations outside the US and Canada send a serial number in place of a state or province. ${serialSentence(from)}`);
    }
    if (p.tu) out.push(`${from} begins with TU ("thank you") to end ${from}'s previous contact with another station.`);
    if (p.r) out.push(`${from} also confirms receiving ${to}'s exchange: the R before the report is short for "Roger", meaning "received".`);
}

function explainEuVhf(p, out) {
    const to = p.to.text, from = p.from.text;
    const exchange = `a signal report of ${p.rs} in RS format (readability, strength), serial number ${p.serial}, and ${from}'s 6-character grid square, ${p.grid6} (a Maidenhead locator)`;
    out.push(p.r
        ? `${R_OPENER}${from} confirms receiving ${to}'s EU VHF contest exchange and sends its own exchange. The exchange is ${exchange}.`
        : `${from} sends ${to} the EU VHF contest exchange: ${exchange}. ${serialSentence(from)}`);
    out.push('Both callsigns are sent as hashed callsigns (short codes in place of the full callsigns).');
}

function explainWspr(p, out) {
    const w = p.text.split(' ');
    const wsprNote = 'WSPR is a separate mode for testing how far signals travel, and WSPR-style messages are rarely used in FT8.';
    if (w.length === 3) {
        out.push(`${w[0]} is sending its grid square, ${w[1]}, and its transmitter power, ${w[2]} dBm (decibels relative to 1 milliwatt), in a WSPR-style message. ${wsprNote}`);
    } else if (w.length === 2 && /^\d+$/.test(w[1])) {
        out.push(`${w[0]} is sending its transmitter power, ${w[1]} dBm (decibels relative to 1 milliwatt), in a WSPR-style message. ${wsprNote}`);
    } else if (w.length === 2) {
        out.push(`${w[0]} is sending its grid square, ${w[1]}, in a WSPR-style message. ${wsprNote}`);
    }
}

// Notes about /R, /P and hashed callsigns, once per callsign.
function addCallNotes(p, out) {
    const calls = [p.to, p.from, p.done, p.next, p.fox].filter(c => c && c.text);
    const seen = new Set();
    const bothHashedNoted = p.kind === 'eu-vhf';
    const fullCallNoted = p.kind === 'nonstd';
    let unknownNoted = false;
    if (p.to && p.from && p.to.hashed && p.to.text === p.from.text && p.to.text !== '<...>') {
        out.push(`Both callsigns show as ${p.to.text}. This usually means that two different callsigns have the same hash code, so the software cannot tell them apart.`);
    }
    for (const c of calls) {
        if (seen.has(c.text)) continue;
        seen.add(c.text);
        const plain = c.text.replace(/[<>]/g, '');
        if (c.suffix === '/R') out.push(`${plain} is a rover station (/R suffix), a station that moves between grid squares.`);
        if (c.suffix === '/P') out.push(`${plain} is a portable station (/P suffix), operating away from its usual location.`);
        if (c.text === '<...>') {
            if (!unknownNoted) out.push('The callsign shown as <...> is unknown. It was sent as a hashed callsign (a short code in place of the full callsign), and the receiving software has never received that callsign in full.');
            unknownNoted = true;
        } else if (c.text.startsWith('<') && !bothHashedNoted && !fullCallNoted) {
            out.push(`The callsign ${plain} is a hashed callsign: it is sent as a short code in place of the full callsign, and shown between angle brackets. Software can show a hashed callsign in full only if it already knows the full callsign, for example from an earlier message that contained it.`);
        }
    }
}
