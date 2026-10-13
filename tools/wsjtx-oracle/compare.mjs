#!/usr/bin/env node
// Compares docs/wsjtx/packjt77.js against WSJT-X's packjt77.f90 compiled with gfortran.
//
//   ./build.sh                      # once, builds build/oracle
//   node compare.mjs [--seed=77] [--scale=1] [--examples=25] [--only=<session name prefix>]
//
// Exit code 0 when every command gives identical output.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSessions } from './corpus.mjs';
import * as wsjtx from '../../docs/wsjtx/packjt77.js';

const here = dirname(fileURLToPath(import.meta.url));
const ORACLE = join(here, 'build', 'oracle');
const ORACLE_GARBAGE = join(here, 'build', 'oracle_garbage');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
}));
const seed = parseInt(args.seed ?? '77');
const scale = parseFloat(args.scale ?? '1');
const maxExamples = parseInt(args.examples ?? '25');

if (!existsSync(ORACLE)) {
    console.error(`Missing ${ORACLE}. Run ./build.sh first.`);
    process.exit(2);
}

function runOracle(cmds, exe = ORACLE) {
    const res = spawnSync(exe, [], { input: cmds.join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 28 });
    // Uninitialised character variables print as NUL in the zero-initialised build
    // (for example the grid in a failed unpack); the port uses blanks.
    const lines = res.stdout.split('\n').map(l => l.replace(/\0/g, ' ').trimEnd());
    if (lines.at(-1) === '') lines.pop();
    return { lines, crashed: res.status !== 0, stderr: res.stderr };
}

// Mirrors oracle.f90 command by command.
export function runJs(cmds) {
    const st = new wsjtx.PackJT77();
    const out = [];
    for (const raw of cmds) {
        const L = raw.padEnd(512, ' ');
        try {
            switch (L[0]) {
                case 'G': {
                    const msg = wsjtx.fmtmsg(L.slice(2, 39));
                    const r = wsjtx.genft8Message(st, msg);
                    out.push(`G|${r.c77}|${r.i3}|${r.n3}|${r.success ? 1 : 0}|${r.msgsent.trimEnd()}`);
                    break;
                }
                case 'P':
                case 'T': {
                    const r = L[0] === 'T' ? st.pack77(L.slice(2, 39), 0, 5) : st.pack77(L.slice(2, 39));
                    out.push(`${L[0]}|${r.c77}|${r.i3}|${r.n3}`);
                    break;
                }
                case 'U': {
                    const r = st.unpack77(L.slice(4, 81), parseInt(L[2]));
                    out.push(`U|${r.success ? 1 : 0}|${r.msg.trimEnd()}`);
                    break;
                }
                case 'M': st.mycall13 = L.slice(2, 15).trimEnd(); out.push('M'); break;
                case 'D': st.dxcall13 = L.slice(2, 15).trimEnd(); out.push('D'); break;
                case 'X': st.dxbase = L.slice(2, 8).trimEnd(); out.push('X'); break;
                case 'H': {
                    const r = st.saveHashCall(L.slice(2, 15));
                    out.push(`H|${r.n10 ?? -1}|${r.n12 ?? -1}|${r.n22 ?? -1}`);
                    break;
                }
                default: out.push('?');
            }
        } catch (e) {
            out.push(`!! JS exception: ${e.message}`);
            break;
        }
    }
    return out;
}

let sessions = buildSessions(seed, scale);
if (args.only) sessions = sessions.filter(s => s.name.startsWith(args.only));

// Resolve "U~ nrx msg" placeholders: pack every message once in a separate oracle process.
const toPack = [...new Set(sessions.flatMap(s => s.cmds.filter(c => c.startsWith('U~ ')).map(c => c.slice(5))))];
if (toPack.length) {
    const { lines } = runOracle(toPack.map(m => `P ${m}`));
    const c77Of = new Map(toPack.map((m, i) => [m, lines[i].split('|')[1]]));
    for (const s of sessions) {
        s.cmds = s.cmds.map(c => (c.startsWith('U~ ') ? `U ${c[3]} ${c77Of.get(c.slice(5))}` : c));
    }
}

let compared = 0, sessionsFailed = 0, crashes = 0, undefinedCommands = 0;
const byKind = {};
const examples = [];
const undefinedExamples = [];
for (const s of sessions) {
    const ora = runOracle(s.cmds);
    const js = runJs(s.cmds);

    // Where the zero-initialised and junk-initialised builds disagree, WSJT-X's result
    // depends on uninitialised memory. The port follows the zero-initialised build, so the
    // comparison still covers these commands; they are also counted and listed.
    const junk = runOracle(s.cmds, ORACLE_GARBAGE);
    ora.lines.forEach((l, i) => {
        if (l === junk.lines[i]) return;
        undefinedCommands++;
        if (undefinedExamples.length < 10) undefinedExamples.push(`${s.cmds[i]}\n    zero-init: ${l}\n    junk-init: ${junk.lines[i]}`);
    });
    if (ora.crashed) crashes++;
    const n = Math.min(ora.lines.length, s.cmds.length);
    let failedAt = -1;
    for (let i = 0; i < n; i++) {
        compared++;
        if (ora.lines[i] !== js[i]) { failedAt = i; break; }
    }
    // gfortran aborts on some READ errors; the port throws FortranRuntimeError at the same command.
    if (failedAt < 0 && ora.crashed && !(js[n] ?? '').startsWith('!! JS exception')) failedAt = n;
    if (failedAt >= 0) {
        sessionsFailed++;
        const kind = s.cmds[failedAt]?.[0] ?? 'crash';
        byKind[kind] = (byKind[kind] ?? 0) + 1;
        if (examples.length < maxExamples) {
            examples.push({ session: s.name, index: failedAt, cmd: s.cmds[failedAt], oracle: ora.lines[failedAt] ?? `(oracle crashed) ${ora.stderr.split('\n')[0]}`, js: js[failedAt] });
        }
    }
}

console.log(`seed ${seed}, ${sessions.length} sessions, ${compared} commands compared, oracle crashes: ${crashes}`);
console.log(`commands where WSJT-X's output depends on uninitialised memory: ${undefinedCommands}`);
for (const e of undefinedExamples) console.log(`  ${e}`);
console.log(`sessions with a mismatch: ${sessionsFailed}`, byKind);
for (const e of examples) {
    console.log(`\n[${e.session} #${e.index}] ${e.cmd}\n  oracle: ${e.oracle}\n  js:     ${e.js}`);
}
process.exit(sessionsFailed === 0 ? 0 : 1);
