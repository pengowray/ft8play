// Reads what an FT8 message says, part by part, from its 77 bits plus the decoded text.
//
// The bits decide the message type and what each part is (grid, report, RRR, flags...).
// The decoded text supplies the spelling of callsigns, since hashed calls depend on which
// calls the decoder has seen. Word positions follow WSJT-X 2.7.0 unpack77 (packjt77.f90).

const NTOKENS = 2063592;
const MAX22 = 4194304;
const MAXGRID4 = 32400;
export const GRID_RR73 = 32373; // grid square "RR73": WSJT-X sends RR73 this way, not as the RR73 code (32404)

const int = (bits) => parseInt(bits, 2);

function callInfo(word, n28 = null) {
    if (word == null) return null;
    const hashed = word.startsWith('<') && word.endsWith('>');
    const call = {
        text: word,
        hashed,
        hashKnown: hashed && word !== '<...>',
        suffix: null,
    };
    const m = word.replace(/[<>]/g, '').match(/\/(R|P)$/);
    if (m) call.suffix = '/' + m[1];
    if (n28 != null && n28 >= NTOKENS && n28 < NTOKENS + MAX22) call.hashed = true;
    return call;
}

/**
 * @param {string} bits 77 characters of '0'/'1'
 * @param {string} text decoded message text
 * @returns {object|null} parts, with `kind` describing the message; null if bits are missing
 */
export function parseMessageParts(bits, text) {
    if (!bits || bits.length < 77) return null;
    const i3 = int(bits.slice(74, 77));
    const n3 = int(bits.slice(71, 74));
    const words = (text ?? '').trim().split(/\s+/).filter(Boolean);
    const type = i3 === 0 ? `0.${n3}` : `${i3}`;
    const base = { type, i3, n3, text: (text ?? '').trim() };

    if (i3 === 1 || i3 === 2) return parseStandard(bits, words, base);

    if (i3 === 4) {
        const iflip = bits[70] === '1';
        const icq = bits[73] === '1';
        if (icq) return { ...base, kind: 'nonstd-cq', from: callInfo(words[1]) };
        // The nonstandard call can be blank, which leaves a leading or trailing blank word,
        // so split on single spaces here.
        const w = (text ?? '').trimEnd().split(' ');
        return {
            ...base,
            kind: 'nonstd',
            to: callInfo(w[0] ?? ''),
            from: callInfo(w[1] ?? ''),
            hashedRole: iflip ? 'from' : 'to',
            signoff: w[2] ?? null, // RRR, RR73, 73 or none
        };
    }

    if (i3 === 3) {
        let w = words;
        const tu = w[0] === 'TU;';
        if (tu) w = w.slice(1);
        const r = w[2] === 'R';
        const [rst, exch] = r ? [w[3], w[4]] : [w[2], w[3]];
        const nexch = int(bits.slice(61, 74));
        return {
            ...base, kind: 'rtty-roundup', tu, r,
            to: callInfo(w[0]), from: callInfo(w[1]), rst,
            state: nexch > 8000 ? exch : null,
            serial: nexch > 8000 ? null : exch,
        };
    }

    if (i3 === 5) {
        const r = words[2] === 'R';
        const [exch, grid6] = r ? [words[3], words[4]] : [words[2], words[3]];
        return {
            ...base, kind: 'eu-vhf', r,
            to: callInfo(words[0]), from: callInfo(words[1]),
            rs: exch?.slice(0, 2), serial: exch?.slice(2), grid6,
        };
    }

    if (i3 >= 6) return { ...base, kind: 'undefined' };

    // i3 = 0
    switch (n3) {
        case 0: return { ...base, kind: 'free-text', freeText: base.text };
        case 1: return {
            ...base, kind: 'dxpedition',
            done: callInfo(words[0]), next: callInfo(words[2]), fox: callInfo(words[3]), report: words[4],
        };
        case 3:
        case 4: {
            const r = words[2] === 'R';
            const [exch, section] = r ? [words[3], words[4]] : [words[2], words[3]];
            const m = (exch ?? '').match(/^(\d+)([A-Z])$/);
            return {
                ...base, kind: 'field-day', r,
                to: callInfo(words[0]), from: callInfo(words[1]),
                ntx: m ? parseInt(m[1]) : null, fdClass: m ? m[2] : null, section,
            };
        }
        case 5: {
            const hex = base.text.replace(/^0+/, '');
            return { ...base, kind: 'telemetry', hex };
        }
        case 6: return { ...base, kind: 'wspr' };
        default: return { ...base, kind: 'undefined' };
    }
}

function parseStandard(bits, words, base) {
    const n28a = int(bits.slice(0, 28));
    const n28b = int(bits.slice(29, 57));
    const ir = bits[58] === '1';
    const g15 = int(bits.slice(59, 74));

    const parts = { ...base, r: ir };
    let rest;
    if (n28a <= 2) {
        parts.lead = ['DE', 'QRZ', 'CQ'][n28a];
        parts.from = callInfo(words[1], n28b);
        rest = words.slice(2);
    } else if (n28a < NTOKENS) {
        // CQ with a 3-digit number (n28 3 to 1002) or up to 4 letters
        parts.lead = 'CQ';
        parts.cqMod = words[1];
        parts.cqModIsNumber = n28a <= 1002;
        parts.from = callInfo(words[2], n28b);
        rest = words.slice(3);
    } else {
        parts.to = callInfo(words[0], n28a);
        parts.from = callInfo(words[1], n28b);
        rest = words.slice(2);
    }

    if (g15 <= MAXGRID4) {
        parts.grid = rest.at(-1) ?? null;
        if (g15 === GRID_RR73 && !ir) {
            parts.tail = 'RR73';
            parts.rr73AsGrid = true;
        } else {
            parts.tail = ir ? 'R-grid' : 'grid';
        }
    } else {
        const irpt = g15 - MAXGRID4;
        if (irpt === 1) parts.tail = 'none';
        else if (irpt === 2) parts.tail = 'RRR';
        else if (irpt === 3) parts.tail = 'RR73';
        else if (irpt === 4) parts.tail = '73';
        else {
            parts.tail = ir ? 'R-report' : 'report';
            parts.report = (rest.at(-1) ?? '').replace(/^R/, '');
        }
    }
    parts.kind = parts.lead ? (parts.lead === 'CQ' ? 'cq' : parts.lead.toLowerCase()) : 'standard';
    return parts;
}
