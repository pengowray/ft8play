// Generates command sessions for the packjt77 oracle (see oracle.f90 for the command format).
// Each session is an array of command lines, run in a fresh process / fresh PackJT77.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function makeGen(seed) {
    const rnd = mulberry32(seed);
    const int = (a, b) => a + Math.floor(rnd() * (b - a + 1)); // inclusive
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const chance = (p) => rnd() < p;
    const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const DIG = '0123456789';
    const ALNUM = LET + DIG;
    const FREE = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?';
    const str = (chars, n) => Array.from({ length: n }, () => pick(chars)).join('');

    function stdCall() {
        // prefix: 1-2 chars (letter/digit mix), area digit, suffix 1-3 letters
        let pfx;
        switch (int(0, 5)) {
            case 0: pfx = pick(LET); break;
            case 1: pfx = pick(LET) + pick(LET); break;
            case 2: pfx = pick(LET) + pick(DIG); break;
            case 3: pfx = pick(DIG) + pick(LET); break;
            default: pfx = pick(['K', 'W', 'N', 'VK', 'G', 'DL', 'JA', 'PA', 'F', 'EA', 'ZL', 'VE', 'KH', 'KA', 'WB', 'VP', 'Q', 'QU']);
        }
        return pfx + pick(DIG) + str(LET, int(1, 3));
    }
    function oddCall() {
        switch (int(0, 9)) {
            case 0: return str(ALNUM, int(1, 12));
            case 1: return pick(['YW18FIFA', 'KH1/KH7Z', 'PJ4/K1ABC', 'VP2E/KA1ABC', 'TX9A/P', 'W9XYZ/7', 'K1ABC/QRP', 'QU1RK', 'QU1RK/P', 'E51ABC', '3D2AG', '4U1ITU', '9A1A', 'T88XX', 'VK9/W1AW', 'A1', 'K1A', '8J1RL']);
            case 2: return stdCall() + '/' + pick(['P', 'R', 'M', 'MM', 'QRP', '1', '7', 'A']);
            case 3: return pick([pick(LET) + pick(LET), pick(LET) + pick(DIG), 'VK9', 'KH6', 'PJ4', 'VP2E']) + '/' + stdCall();
            case 4: return str(LET, int(2, 4)) + str(DIG, int(1, 4)) + str(LET, int(0, 4));
            case 5: return pick(DIG) + pick(DIG) + str(LET, int(1, 3));
            case 6: return pick(LET) + pick(LET) + pick(LET) + pick(DIG) + str(LET, int(1, 3));
            case 7: return stdCall() + '/' + stdCall();
            case 8: return str(ALNUM + '/', int(3, 13));
            default: return stdCall().toLowerCase();
        }
    }
    const call = () => (chance(0.65) ? stdCall() : oddCall());
    const hashed = () => '<' + call() + '>';
    const anyCall = () => (chance(0.15) ? hashed() : call());

    function grid4() {
        if (chance(0.1)) return pick(['RR73', 'RR99', 'AA00', 'RR00', 'SA00', 'AS11', 'JJ00', 'ZZ99', 'RR7', 'R73']);
        return pick('ABCDEFGHIJKLMNOPQR'.split('')) + pick('ABCDEFGHIJKLMNOPQR'.split('')) + pick(DIG) + pick(DIG);
    }
    function grid6() {
        const sub = 'ABCDEFGHIJKLMNOPQRSTUVWX';
        let g = grid4() + pick(sub.split('')) + pick(sub.split(''));
        if (chance(0.1)) g = g.slice(0, 4) + pick(['YZ', 'ZZ', 'mm', 'AA', 'XX', 'A']);
        return g;
    }
    function report() {
        const n = int(-60, 60);
        const sign = n < 0 ? '-' : (chance(0.85) ? '+' : '');
        let s = sign + String(Math.abs(n)).padStart(chance(0.9) ? 2 : 1, '0');
        if (chance(0.3)) s = 'R' + s;
        return s;
    }
    function rst() {
        return pick(['5', '4', '3', '2', '1']) + pick(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) + pick(['9', '8', '7', '0', '5']);
    }
    const STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY NB NS QC ON MB SK AB BC NWT NF LB NU YT PEI DC DR FR GD GR OV ZH ZL X01 X45 X99 X00 XX ZZ'.split(' ');
    const SECS = 'AB AK AL AR AZ BC CO CT DE EB EMA ENY EPA EWA GA GH IA ID IL IN KS KY LA LAX NS MB MDC ME MI MN MO MS MT NC ND NE NFL NH NL NLI NM NNJ NNY TER NTX NV OH OK ONE ONN ONS OR ORG PAC PR QC RI SB SC SCV SD SDG SF SFL SJV SK SNJ STX SV TN UT VA VI VT WCF WI WMA WNY WPA WTX WV WWA WY DX PE NB ZZZ XX GTA'.split(' ');
    const CQ_MODS = ['', 'DX', 'NA', 'EU', 'AS', 'TEST', 'FD', 'RU', 'POTA', 'SOTA', 'WW', 'ABCD', 'A', 'AB', 'ABCDE', '000', '123', '999', '1000', '12', 'QRP', 'JA', 'VK', 'X1', 'TEST1'];

    function cqMessage() {
        const head = pick(['CQ', 'CQ', 'CQ', 'QRZ', 'DE', 'CQ_' + pick(CQ_MODS)]);
        const mod = chance(0.4) ? pick(CQ_MODS) : '';
        const parts = [head];
        if (mod) parts.push(mod);
        parts.push(chance(0.85) ? call() : hashed());
        if (chance(0.7)) parts.push(chance(0.8) ? grid4() : grid6());
        return parts.join(' ');
    }
    function stdMessage() {
        const a = anyCall(), b = anyCall();
        const tail = pick([grid4, grid4, report, report, () => 'RRR', () => 'RR73', () => '73', () => 'R ' + grid4(), () => '', grid6, () => 'R ' + report()])();
        return [a, b, tail].filter(Boolean).join(' ');
    }
    function rttyMessage() {
        const parts = [];
        if (chance(0.2)) parts.push('TU;');
        parts.push(call(), call());
        if (chance(0.4)) parts.push('R');
        parts.push(rst());
        parts.push(chance(0.6) ? pick(STATES) : String(int(0, 8000)).padStart(int(1, 4), '0'));
        return parts.join(' ');
    }
    function fdMessage() {
        const parts = [call(), call()];
        if (chance(0.4)) parts.push('R');
        parts.push(String(int(0, 40)) + pick('ABCDEFGHIJ'.split('')));
        parts.push(pick(SECS));
        return parts.join(' ');
    }
    function euvhfMessage() {
        const parts = [chance(0.7) ? hashed() : call(), chance(0.7) ? hashed() : call()];
        if (chance(0.3)) parts.push('R');
        parts.push(rst() + String(int(0, 4095)).padStart(chance(0.8) ? 4 : int(1, 5), '0'));
        parts.push(grid6());
        return parts.join(' ');
    }
    function euvhfType2() { // i3=2, /P calls
        const a = chance(0.5) ? stdCall() + '/P' : stdCall();
        const b = chance(0.5) ? stdCall() + '/P' : stdCall();
        return [a, b, pick([grid4(), report(), 'RRR', 'RR73', '73', 'R ' + grid4()])].join(' ');
    }
    function dxpedMessage() {
        return `${call()} RR73; ${call()} ${chance(0.8) ? hashed() : call()} ${report().replace(/^R/, '')}`;
    }
    function nonstdMessage() {
        const ns = oddCall();
        const st = hashed();
        const order = chance(0.5) ? [ns, st] : [st, ns];
        const tail = pick(['', 'RRR', 'RR73', '73', '-10', grid4()]);
        if (chance(0.15)) return 'CQ ' + ns;
        return [...order, tail].filter(Boolean).join(' ');
    }
    function telemetry() {
        const n = pick([18, 18, 18, int(1, 20)]);
        return str('0123456789ABCDEFabcdef', n);
    }
    function freeText() {
        let s = str(FREE, int(1, 15));
        if (chance(0.1)) s = s.toLowerCase();
        if (chance(0.05)) s = str(FREE + '!@#*_<>;:,abc', int(1, 15));
        return s;
    }
    function soup() {
        const toks = [call, hashed, grid4, grid6, report, rst, () => pick(['CQ', 'DE', 'QRZ', 'RRR', 'RR73', '73', 'R', 'TU;', 'RR73;', '$DX', 'TNX', 'DX', 'TEST']), () => pick(STATES), () => pick(SECS), () => str(ALNUM, int(1, 8))];
        return Array.from({ length: int(1, 6) }, () => pick(toks)()).join(' ');
    }
    function spacing(msg) {
        // occasionally add odd spacing / case
        if (chance(0.05)) msg = '  ' + msg;
        if (chance(0.05)) msg = msg.replace(/ /g, '   ');
        if (chance(0.05)) msg = msg.toLowerCase();
        return msg;
    }
    function message() {
        const g = pick([cqMessage, stdMessage, stdMessage, stdMessage, rttyMessage, fdMessage, euvhfMessage, euvhfType2, dxpedMessage, nonstdMessage, nonstdMessage, telemetry, freeText, soup, soup]);
        return spacing(g());
    }

    function bits(n) { let s = ''; for (let i = 0; i < n; i++) s += chance(0.5) ? '1' : '0'; return s; }
    function bitsOf(v, n) { return v.toString(2).padStart(n, '0').slice(-n); }
    function n28() {
        // biased toward special ranges: tokens, CQ nnn, CQ abcd, hashes, standard calls, invalid
        switch (int(0, 7)) {
            case 0: return int(0, 2);
            case 1: return int(3, 1002);
            case 2: return int(1003, 532443);
            case 3: return int(2063592, 2063592 + 4194303);
            case 4: return int(2063592 + 4194304, 268435455);
            case 5: return int(532444, 2063591);
            default: return int(0, 268435455);
        }
    }
    function c77() {
        const i3 = pick([0, 0, 1, 1, 1, 2, 3, 4, 5, 6, 7]);
        const n3 = i3 === 0 ? int(0, 7) : int(0, 7);
        let body;
        if (chance(0.5)) {
            body = bits(71);
        } else if (i3 === 1 || i3 === 2) {
            body = bitsOf(n28(), 28) + bits(1) + bitsOf(n28(), 28) + bits(1) + bits(1) + bitsOf(chance(0.3) ? int(32400, 32400 + 70) : int(0, 32767), 15);
            return body + bitsOf(i3, 3);
        } else if (i3 === 0 && n3 === 1) {
            body = bitsOf(n28(), 28) + bitsOf(n28(), 28) + bits(10) + bits(5);
        } else if (i3 === 3) {
            body = bits(1) + bitsOf(n28(), 28) + bitsOf(n28(), 28) + bits(1) + bits(3) + bitsOf(int(0, 8191), 13);
            return body + bitsOf(i3, 3);
        } else if (i3 === 0 && (n3 === 3 || n3 === 4)) {
            body = bitsOf(n28(), 28) + bitsOf(n28(), 28) + bits(1) + bits(4) + bits(3) + bitsOf(int(0, 90), 7);
        } else {
            body = bits(71);
        }
        if (i3 === 0) return body + bitsOf(n3, 3) + '000';
        return body.slice(0, 74) + bitsOf(i3, 3);
    }
    function c77FullRandom() { return bits(77); }

    return { int, pick, chance, call, stdCall, oddCall, hashed, message, telemetry, freeText, c77, c77FullRandom };
}

function readTestMessages() {
    const dir = join(here, 'wsjtx-2.7.0', 'testmsgs');
    const out = new Set();
    for (const f of readdirSync(dir)) {
        const text = readFileSync(join(dir, f), 'utf8');
        if (f.endsWith('.f90')) {
            for (const m of text.matchAll(/"([^"]*)"/g)) out.add(m[1]);
            continue;
        }
        for (let line of text.split(/\r?\n/)) {
            line = line.trim();
            if (!line || /^[-=]+$/.test(line) || /^\d+\.\s/.test(line) || /^i3\s+n3/.test(line)) continue;
            if (f === 'msgtypes.txt') {
                const m = line.match(/^\d\s+\d?\s+(.*?)\s{2,}/);
                if (m) out.add(m[1]);
                continue;
            }
            out.add(line.slice(0, 37));
        }
    }
    const fixtures = readFileSync(join(here, '..', '..', 'docs', 'ft8_tests.js'), 'utf8');
    for (const m of fixtures.matchAll(/"message":\s*"([^"]*)"/g)) out.add(m[1]);
    return [...out].filter(s => s.length > 0);
}

const pad37 = (s) => s.slice(0, 37);

export function buildSessions(seed = 77, scale = 1) {
    const g = makeGen(seed);
    const sessions = [];

    // 1. Known messages from WSJT-X test files and ft8_tests.js, one fresh session each and all together.
    const known = readTestMessages();
    sessions.push({ name: 'known-together', cmds: known.flatMap(m => [`G ${pad37(m)}`, `P ${pad37(m)}`]) });
    for (const m of known) sessions.push({ name: `known:${m}`, cmds: [`G ${pad37(m)}`] });

    // Inputs that make WSJT-X 2.7.0 abort with a Fortran runtime error (packjt77.f90:678).
    for (const m of ['CQ 12.3 K1ABC', 'CQ_12+ K1ABC FN42', 'CQ 1-2 W9XYZ']) {
        sessions.push({ name: `crash:${m}`, cmds: ['G K1ABC W9XYZ -10', `G ${m}`] });
    }

    // 2. Random messages, genft8 path and raw pack77 path.
    for (let s = 0; s < 120 * scale; s++) {
        const cmds = [];
        for (let i = 0; i < 150; i++) {
            const m = pad37(g.message());
            cmds.push(`${g.pick(['G', 'G', 'G', 'P'])} ${m}`);
            if (g.chance(0.03)) cmds.push(`T ${g.telemetry()}`);
        }
        sessions.push({ name: `random-msgs-${s}`, cmds });
    }

    // 3. Random 77-bit strings, unpacked as received and as transmitted.
    for (let s = 0; s < 60 * scale; s++) {
        const cmds = [];
        for (let i = 0; i < 300; i++) {
            const c = g.chance(0.8) ? g.c77() : g.c77FullRandom();
            cmds.push(`U ${g.chance(0.6) ? 1 : 0} ${c}`);
        }
        sessions.push({ name: `random-bits-${s}`, cmds });
    }

    // 4. Stateful sessions: my call / DX call / known hashes, then a mix of packs and unpacks.
    for (let s = 0; s < 120 * scale; s++) {
        const cmds = [];
        const pool = Array.from({ length: g.int(2, 12) }, () => (g.chance(0.6) ? g.stdCall() : g.oddCall()));
        if (g.chance(0.8)) cmds.push(`M ${g.pick(pool).slice(0, 13)}`);
        if (g.chance(0.6)) cmds.push(`D ${g.pick(pool).slice(0, 13)}`);
        if (g.chance(0.2)) cmds.push(`X ${g.stdCall().slice(0, 6)}`);
        const template = () => {
            const a = g.pick(pool), b = g.pick(pool);
            return g.pick([
                `${a} ${b} ${g.pick(['-10', 'R-05', 'RRR', 'RR73', '73', 'FN42', 'R FN42', ''])}`,
                `<${a}> ${b} ${g.pick(['-10', 'RRR', '73', ''])}`,
                `${a} <${b}> ${g.pick(['-10', 'RRR', 'RR73', ''])}`,
                `CQ ${a}`, `CQ ${a} FN42`, `CQ POTA ${a}`,
                `${a} RR73; ${b} <${g.pick(pool)}> -12`,
                `<${a}> <${b}> 570123 JO22AB`,
                `$DX ${b} -07`, `$DX ${b} R-07`,
            ]).trim();
        };
        for (let i = 0; i < 100; i++) {
            const r = g.int(0, 9);
            const a = g.pick(pool);
            if (r === 0) cmds.push(`H ${a.slice(0, 13)}`);
            else if (r === 1) cmds.push(`M ${a.slice(0, 13)}`);
            else if (r === 2) cmds.push(`D ${a.slice(0, 13)}`);
            else if (r <= 5) cmds.push(`${g.pick(['G', 'G', 'P'])} ${pad37(template())}`);
            else if (r <= 8) {
                // Placeholder: compare.mjs packs the message in a separate process first,
                // then this session unpacks the bits, so hash lookups see this session's tables.
                cmds.push(`U~ ${g.chance(0.7) ? 1 : 0} ${pad37(template())}`);
            } else {
                cmds.push(`U ${g.chance(0.7) ? 1 : 0} ${g.c77()}`);
            }
        }
        sessions.push({ name: `stateful-${s}`, cmds });
    }
    return sessions;
}
