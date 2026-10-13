// packjt77.js
//
// Line-by-line JavaScript port of WSJT-X 2.7.0 lib/77bit/packjt77.f90
// (plus chkcall.f90, fmtmsg.f90 and the text part of genft8.f90).
//
// WSJT-X is Copyright (C) 2001-2024 by Joe Taylor, K1JT, and the WSJT
// Development Group, and is licensed under the GNU General Public License
// version 3 (see tools/wsjtx-oracle/wsjtx-2.7.0/COPYING). This port is a
// derivative work and carries the same licence.
//
// Goal: behave exactly like the Fortran compiled with gfortran, bugs included.
// Every routine starts with a `// packjt77.f90:NNN` comment (or chkcall.f90 /
// fmtmsg.f90 / genft8.f90) and every labelled statement / goto target is
// marked the same way, so the code can be audited against the source.
// Original Fortran comments are kept (lines starting with `// !`).
//
// Search for "FORTRAN-SEMANTICS" to find every place where the behaviour
// depends on an assumption about gfortran / libgfortran, and for "UB:" to
// find every place where the Fortran reads an uninitialised variable. Each
// pack77()/unpack77() call records the UB cases it actually hit in
// `instance.lastUB` (array of strings, empty when none).
//
// Conventions used below:
//  - character*N variables are JS strings of exactly N chars (fstr pads or
//    truncates). Fortran .eq./.ne. on strings is feq() (blank-padded compare).
//  - Fortran arrays keep their Fortran index base (element 0 unused for
//    1-based arrays) so indices match the source.
//  - Default integers are 32-bit; additions that can overflow use `| 0`.
//    integer*8 is BigInt.
//  - Strings are treated as byte strings: one JS char = one Fortran byte.
//    Only chars with code < 256 are meaningful.

// FORTRAN-SEMANTICS: list-directed READ and the ';' character.
// gfortran <= 13.2 treats ';' as a value separator (like ',') in list-directed
// input even with DECIMAL='POINT'. gfortran 14+ (PR libfortran/105473, also
// backported to 13.3) reports an error instead ("Semicolon not allowed as
// separator with DECIMAL='point'"). Default: modern behaviour (error).
// To mimic an older gfortran, set gfortranOptions.semicolonIsSeparator = true
// from the importing code (applies to every PackJT77 instance).
export const gfortranOptions = { semicolonIsSeparator: false };

// Thrown where the Fortran program would stop with a libgfortran runtime
// error (a READ hitting an error or end-of-file with no ERR=/END= label).
export class FortranRuntimeError extends Error {
  constructor(message, where) {
    super(`Fortran runtime error at ${where}: ${message}`);
    this.name = 'FortranRuntimeError';
    this.where = where;
  }
}

// ---------------------------------------------------------------------------
// Fortran character helpers
// ---------------------------------------------------------------------------

// Fixed-length assignment: pad with blanks or truncate to n.
function fstr(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

// Fortran character .eq.: the shorter operand is blank-padded.
function feq(a, b) {
  const n = Math.max(a.length, b.length);
  return fstr(a, n) === fstr(b, n);
}

// trim(): removes trailing blanks only (not NULs or tabs).
function trimF(s) {
  let e = s.length;
  while (e > 0 && s.charCodeAt(e - 1) === 32) e--;
  return s.slice(0, e);
}

// len_trim() / len(trim())
function lenTrim(s) {
  return trimF(s).length;
}

// adjustl(): leading blanks moved to the end, same length.
function adjustl(s) {
  let i = 0;
  while (i < s.length && s.charCodeAt(i) === 32) i++;
  return s.slice(i) + ' '.repeat(i);
}

// adjustr(): trailing blanks moved to the front, same length.
function adjustr(s) {
  const t = trimF(s);
  return ' '.repeat(s.length - t.length) + t;
}

// index(s, sub): 1-based, 0 when not found (index(s,'') = 1 as in Fortran).
function findex(s, substr) {
  return s.indexOf(substr) + 1;
}

// s(i:j), 1-based inclusive. Zero length when j < i.
function sub(s, i, j) {
  if (j < i) return '';
  if (i < 1 || j > s.length) {
    // gfortran without -fcheck=bounds would read neighbouring memory.
    // All substrings in packjt77.f90 were checked to stay in range, so
    // reaching this means a bug in the port.
    throw new Error(`FORTRAN-SEMANTICS: substring (${i}:${j}) out of range for length ${s.length}`);
  }
  return s.slice(i - 1, j);
}

// s(i:)
function subFrom(s, i) {
  return sub(s, i, s.length);
}

// s(i:j) = v   (v padded or truncated to j-i+1). Returns the new string.
function setSub(s, i, j, v) {
  if (j < i) return s;
  if (i < 1 || j > s.length) {
    throw new Error(`FORTRAN-SEMANTICS: substring assignment (${i}:${j}) out of range for length ${s.length}`);
  }
  return s.slice(0, i - 1) + fstr(v, j - i + 1) + s.slice(j);
}

function ichar(c) {
  return c.charCodeAt(0);
}

function char(n) {
  return String.fromCharCode(n);
}

function isDigitC(c) {
  return c >= '0' && c <= '9';
}

function isLetterC(c) {
  return c >= 'A' && c <= 'Z';
}

// Concatenate and assign to a character*37 msg.
function f37(...parts) {
  return fstr(parts.join(''), 37);
}

// Concatenate and assign to a character*13 variable.
function f13(...parts) {
  return fstr(parts.join(''), 13);
}

// nint(): round half away from zero.
function nint(x) {
  return x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5);
}

// ---------------------------------------------------------------------------
// Formatted I/O helpers (libgfortran write.c / read.c behaviour)
// ---------------------------------------------------------------------------

// FORTRAN-SEMANTICS: Bw.m output (write_b/write_boz). The value is printed as
// the unsigned bit pattern of its storage (32 bits for default integer, 64
// for integer*8, so negative values need 32/64 digits), zero-padded to m
// digits, right-justified in w. If it doesn't fit in w: w asterisks.
// m = -1 means ".m" was not given (minimum 1 digit). m = 0 and value 0: blanks.
function fmtB(v, w, m = -1) {
  let bits;
  if (typeof v === 'bigint') {
    const u = BigInt.asUintN(64, v);
    if (m === 0 && u === 0n) return ' '.repeat(w);
    bits = u.toString(2);
  } else {
    const u = v >>> 0;
    if (m === 0 && u === 0) return ' '.repeat(w);
    bits = u.toString(2);
  }
  const digits = bits.length;
  const nzero = digits < m ? m - digits : 0;
  const nblank = w - (nzero + digits);
  if (nblank < 0) return '*'.repeat(w);
  return ' '.repeat(nblank) + '0'.repeat(nzero) + bits;
}

// FORTRAN-SEMANTICS: Zw.m output, same rules as B; hex digits are upper case.
function fmtZ(v, w, m = -1) {
  const u = v >>> 0;
  if (m === 0 && u === 0) return ' '.repeat(w);
  const hex = u.toString(16).toUpperCase();
  const digits = hex.length;
  const nzero = digits < m ? m - digits : 0;
  const nblank = w - (nzero + digits);
  if (nblank < 0) return '*'.repeat(w);
  return ' '.repeat(nblank) + '0'.repeat(nzero) + hex;
}

// FORTRAN-SEMANTICS: Iw.m output (write_decimal). No '+' for positive
// values (SIGN mode is processor default = suppress). Overflow: w asterisks.
function fmtI(v, w, m = -1) {
  if (m === 0 && v === 0) return ' '.repeat(w);
  const neg = v < 0;
  const q = String(Math.abs(v));
  const nsign = neg ? 1 : 0;
  const digits = q.length;
  const nzero = digits < m ? m - digits : 0;
  const nblank = w - (nsign + nzero + digits);
  if (nblank < 0) return '*'.repeat(w);
  return ' '.repeat(nblank) + (neg ? '-' : '') + '0'.repeat(nzero) + q;
}

// Bw read of fields that are already known to contain only '0'/'1'
// (unpack77 checks c77 first). Fields wider than 31 bits come back as BigInt.
function readB(s, widths) {
  const out = [];
  let p = 0;
  for (const w of widths) {
    const f = s.slice(p, p + w);
    p += w;
    out.push(w > 31 ? BigInt('0b' + f) : parseInt(f, 2));
  }
  return out;
}

// FORTRAN-SEMANTICS: Z6 input field (read_radix, radix 16) on an internal
// unit, whose default is BLANK='NULL': leading blanks skipped, an all-blank
// field reads as 0, embedded blanks are ignored, one leading '+'/'-' is
// accepted, both 'a'-'f' and 'A'-'F' are accepted, a NUL byte ends the field,
// anything else is an error (ERR= branch).
function readZField(f) {
  let p = 0;
  let w = f.length;
  while (w > 0 && f[p] === ' ') {
    p++;
    w--;
  }
  if (w === 0) return { ok: true, v: 0 };
  let negative = false;
  if (f[p] === '-' || f[p] === '+') {
    negative = f[p] === '-';
    p++;
    if (--w === 0) return { ok: false };
  }
  let value = 0;
  while (w > 0) {
    const c = f[p++];
    w--;
    if (c === '\0') break;
    if (c === ' ') continue;
    let d;
    if (c >= '0' && c <= '9') d = ichar(c) - 48;
    else if (c >= 'a' && c <= 'f') d = ichar(c) - 87;
    else if (c >= 'A' && c <= 'F') d = ichar(c) - 55;
    else return { ok: false };
    value = value * 16 + d; // at most 6 digits: no overflow possible
  }
  return { ok: true, v: negative ? -value : value };
}

// List-directed READ of one default integer from an internal unit:
// read(s,*) n
const LR_OK = 'ok'; // value read
const LR_NULL = 'null'; // null value: variable left unchanged, no error
const LR_ERR = 'err'; // error condition (ERR= branch, or abort)
const LR_EOF = 'eof'; // end-of-file condition (END= branch, or abort)

// FORTRAN-SEMANTICS: port of libgfortran list_read.c
// (list_formatted_read_scalar first-item handling + read_integer +
// convert_integer + eat_separator):
//  - leading ' ', '\t', '\r' skipped; nothing left -> end-of-file;
//  - first char a separator (' ' ',' '/' '\n' '\t' '\r' or ';') -> null value;
//  - optional sign, then digits; the value ends at a separator or the end of
//    the string; any other char -> error (or end-of-file when the bad char
//    is the end of the string, e.g. "1*" with nothing after it);
//  - "r*v" repeat counts: r must be 1..200000000 (0 or more -> error), then v
//    may be null ("3*" followed by a blank);
//  - value must fit int32 (-2147483648..2147483647), else error;
//  - ';' acting as a separator: see gfortranOptions.semicolonIsSeparator.
// On error/eof the variable is left unchanged.
function listReadInt(s) {
  const EOF = null;
  const n = s.length;
  let p = 0;
  const next = () => (p < n ? s[p++] : EOF);
  const isDigit = (c) => c !== EOF && c >= '0' && c <= '9';
  const isSep = (c) =>
    c === ' ' || c === ',' || c === '/' || c === '\n' || c === '\t' || c === '\r' || c === ';';
  const MAX_REPEAT = 200000000;

  // eat_separator() after a value or null: only matters for ';'
  const eatSeparator = () => {
    let c;
    do {
      c = next();
    } while (c !== EOF && (c === ' ' || c === '\r' || c === '\t'));
    if (c === ';' && !gfortranOptions.semicolonIsSeparator) return false;
    return true;
  };
  const bad = (c) => ({ st: c === EOF ? LR_EOF : LR_ERR });
  const convert = (digits, negative, max) => {
    let v = 0;
    const max10 = Math.floor(max / 10);
    for (const ch of digits) {
      const d = ichar(ch) - 48;
      if (v > max10) return null;
      v = 10 * v;
      if (v > max - d) return null;
      v += d;
    }
    return negative ? -v : v;
  };
  // done: (after the digits of the value)
  const done = (digits, negative) => {
    p--; // unget_char
    if (p < 0) p = 0;
    if (!eatSeparator()) return { st: LR_ERR };
    const v = convert(digits, negative, negative ? 2147483648 : 2147483647);
    if (v === null) return { st: LR_ERR }; // "Integer overflow while reading item"
    return { st: LR_OK, v };
  };
  // get_integer: c must be the first digit of the value
  const getInteger = (c, negative) => {
    if (!isDigit(c)) return bad(c);
    let digits = c;
    for (;;) {
      c = next();
      if (isDigit(c)) {
        digits += c;
        continue;
      }
      if (c === EOF || isSep(c)) {
        if (c === EOF) p++; // so that done()'s unget leaves p at the end
        return done(digits, negative);
      }
      return bad(c); // includes '!'
    }
  };

  // first item: eat_spaces
  let c;
  do {
    c = next();
  } while (c !== EOF && (c === ' ' || c === '\r' || c === '\t'));
  if (c === EOF) return { st: LR_EOF };
  if (isSep(c)) {
    // Found a null value.
    if (c === ';' && !gfortranOptions.semicolonIsSeparator) return { st: LR_ERR };
    return { st: LR_NULL };
  }

  // read_integer
  if (c === '+' || c === '-') {
    const negative = c === '-';
    return getInteger(next(), negative);
  }
  if (!isDigit(c)) return bad(c);
  // Take care of what may be a repeat count.
  let digits = c;
  for (;;) {
    c = next();
    if (isDigit(c)) {
      digits += c;
      continue;
    }
    if (c === '*') break; // repeat
    if (c === EOF || isSep(c)) {
      if (c === EOF) p++;
      return done(digits, false);
    }
    return bad(c);
  }
  // repeat:
  const r = convert(digits, false, MAX_REPEAT);
  if (r === null) return { st: LR_ERR }; // "Repeat count overflow"
  if (r === 0) return { st: LR_ERR }; // "Zero repeat count"
  // Get the real integer.
  c = next();
  if (isDigit(c)) return getInteger(c, false);
  if (c === '!') return bad(c);
  if (c !== EOF && isSep(c)) {
    // null value after the repeat count
    p--;
    if (!eatSeparator()) return { st: LR_ERR };
    return { st: LR_NULL };
  }
  if (c === '-') return getInteger(next(), true);
  if (c === '+') return getInteger(next(), false);
  return getInteger(c, false); // not a digit: bad_integer (EOF -> end-of-file)
}

// ---------------------------------------------------------------------------
// Constants and data tables
// ---------------------------------------------------------------------------

const MAXHASH = 1000;
const MAXRECENT = 10;
const NTOKENS = 2063592;
const MAX22 = 4194304;
const MAXGRID4 = 32400;
const NSEC = 86;
const NUSCAN = 171;
const NZZZ = 46656;
const BLANK13 = ' '.repeat(13);

const C38 = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/';
const C42 = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?';
const A1 = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const A2 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const A3 = '0123456789';
const A4 = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// csec(NSEC): ARRL sections (1-based; element 0 unused)
const CSEC = [
  null,
  'AB ', 'AK ', 'AL ', 'AR ', 'AZ ', 'BC ', 'CO ', 'CT ', 'DE ', 'EB ',
  'EMA', 'ENY', 'EPA', 'EWA', 'GA ', 'GH ', 'IA ', 'ID ', 'IL ', 'IN ',
  'KS ', 'KY ', 'LA ', 'LAX', 'NS ', 'MB ', 'MDC', 'ME ', 'MI ', 'MN ',
  'MO ', 'MS ', 'MT ', 'NC ', 'ND ', 'NE ', 'NFL', 'NH ', 'NL ', 'NLI',
  'NM ', 'NNJ', 'NNY', 'TER', 'NTX', 'NV ', 'OH ', 'OK ', 'ONE', 'ONN',
  'ONS', 'OR ', 'ORG', 'PAC', 'PR ', 'QC ', 'RI ', 'SB ', 'SC ', 'SCV',
  'SD ', 'SDG', 'SF ', 'SFL', 'SJV', 'SK ', 'SNJ', 'STX', 'SV ', 'TN ',
  'UT ', 'VA ', 'VI ', 'VT ', 'WCF', 'WI ', 'WMA', 'WNY', 'WPA', 'WTX',
  'WV ', 'WWA', 'WY ', 'DX ', 'PE ', 'NB ',
];

// cmult(NUSCAN): states, provinces and X01..X99 (1-based; element 0 unused)
const CMULT = [
  null,
  'AL ', 'AK ', 'AZ ', 'AR ', 'CA ', 'CO ', 'CT ', 'DE ', 'FL ', 'GA ',
  'HI ', 'ID ', 'IL ', 'IN ', 'IA ', 'KS ', 'KY ', 'LA ', 'ME ', 'MD ',
  'MA ', 'MI ', 'MN ', 'MS ', 'MO ', 'MT ', 'NE ', 'NV ', 'NH ', 'NJ ',
  'NM ', 'NY ', 'NC ', 'ND ', 'OH ', 'OK ', 'OR ', 'PA ', 'RI ', 'SC ',
  'SD ', 'TN ', 'TX ', 'UT ', 'VT ', 'VA ', 'WA ', 'WV ', 'WI ', 'WY ',
  'NB ', 'NS ', 'QC ', 'ON ', 'MB ', 'SK ', 'AB ', 'BC ', 'NWT', 'NF ',
  'LB ', 'NU ', 'YT ', 'PEI', 'DC ', 'DR ', 'FR ', 'GD ', 'GR ', 'OV ',
  'ZH ', 'ZL ',
];
for (let i = 1; i <= 99; i++) CMULT.push('X' + String(i).padStart(2, '0'));
if (CSEC.length !== NSEC + 1 || CMULT.length !== NUSCAN + 1) {
  throw new Error('packjt77.js: table size mismatch');
}

// is_grid4() statement function of pack77_06 and pack77_1
// (packjt77.f90:997 and :1128)
function isGrid4(grid4in) {
  const grid4 = fstr(grid4in, 4);
  return (
    lenTrim(grid4) === 4 &&
    grid4[0] >= 'A' && grid4[0] <= 'R' &&
    grid4[1] >= 'A' && grid4[1] <= 'R' &&
    grid4[2] >= '0' && grid4[2] <= '9' &&
    grid4[3] >= '0' && grid4[3] <= '9'
  );
}

// is_grid6() statement function of pack77_06 (4 or 6 chars)
// packjt77.f90:1003
function isGrid6_06(grid6in) {
  const grid6 = fstr(grid6in, 6);
  const lt = lenTrim(grid6);
  return (
    (lt === 6 || lt === 4) &&
    grid6[0] >= 'A' && grid6[0] <= 'R' &&
    grid6[1] >= 'A' && grid6[1] <= 'R' &&
    grid6[2] >= '0' && grid6[2] <= '9' &&
    grid6[3] >= '0' && grid6[3] <= '9' &&
    (lt === 4 ||
      (grid6[4] >= 'A' && grid6[4] <= 'X' &&
        grid6[5] >= 'A' && grid6[5] <= 'X'))
  );
}

// is_grid6() statement function of pack77_5 (6 chars only)
// packjt77.f90:1386
function isGrid6_5(grid6in) {
  const grid6 = fstr(grid6in, 6);
  return (
    lenTrim(grid6) === 6 &&
    grid6[0] >= 'A' && grid6[0] <= 'R' &&
    grid6[1] >= 'A' && grid6[1] <= 'R' &&
    grid6[2] >= '0' && grid6[2] <= '9' &&
    grid6[3] >= '0' && grid6[3] <= '9' &&
    grid6[4] >= 'A' && grid6[4] <= 'X' &&
    grid6[5] >= 'A' && grid6[5] <= 'X'
  );
}

// ---------------------------------------------------------------------------
// Module-level functions
// ---------------------------------------------------------------------------

// integer function ihashcall(c0,m)
// packjt77.f90:64
export function ihashcall(c0in, m) {
  const c0 = fstr(c0in, 13); // character*13 c0
  // character*38 c: ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ/'
  let n8 = 0n; // integer*8
  for (let i = 1; i <= 11; i++) {
    const j = findex(C38, c0[i - 1]) - 1; // -1 for chars not in c
    n8 = 38n * n8 + BigInt(j);
  }
  // FORTRAN-SEMANTICS: 47055833459_8*n8 overflows integer*8 and wraps
  // modulo 2^64 (two's complement); ishft(x, m-64) is a logical right shift
  // of the 64-bit pattern by 64-m bits.
  const prod = BigInt.asUintN(64, 47055833459n * n8);
  return Number(prod >> BigInt(64 - m));
}

// subroutine chkcall(w,bc,cok)
// chkcall.f90:1
// ! Check "w" to see if it could be a valid standard callsign or a valid
// ! compound callsign.
// ! Return base call "bc" and a logical "cok" indicator.
export function chkcall(win) {
  const w = fstr(win, 13); // character w*13 - A putative callsign
  let bc = sub(w, 1, 6); // character bc*6 - Base call (tentative)
  const isdigit = (c) => ichar(c) >= ichar('0') && ichar(c) <= ichar('9');
  const isletter = (c) => ichar(c) >= ichar('A') && ichar(c) <= ichar('Z');

  go100: {
    const n1 = lenTrim(w);
    if (n1 > 11) break go100;
    if (findex(w, '.') >= 1) break go100;
    if (findex(w, '+') >= 1) break go100;
    if (findex(w, '-') >= 1) break go100;
    if (findex(w, '?') >= 1) break go100;
    if (n1 > 6 && findex(w, '/') <= 0) break go100;

    const i0 = findex(w, '/');
    if (Math.max(i0 - 1, n1 - i0) > 6) break go100; // !Base call must be < 7 characters
    if (i0 >= 2 && i0 <= n1 - 1) {
      // !Extract base call from compound call
      if (i0 - 1 <= n1 - i0) bc = fstr(sub(w, i0 + 1, n1) + '   ', 6);
      if (i0 - 1 > n1 - i0) bc = fstr(sub(w, 1, i0 - 1) + '   ', 6);
    }

    const nbc = lenTrim(bc);
    if (nbc > 6) break go100; // !Base call should have no more than 6 characters

    // ! One of first two characters (c1 or c2) must be a letter
    if (!isletter(bc[0]) && !isletter(bc[1])) break go100;
    // ! Real calls don't start with Q, but we'll allow the placeholder
    // ! callsign QU1RK to be considered a standard call:
    if (bc[0] === 'Q' && sub(bc, 1, 5) !== 'QU1RK') break go100;

    // ! Must have a digit in 2nd or 3rd position
    let i1 = 0;
    if (isdigit(bc[1])) i1 = 2;
    if (isdigit(bc[2])) i1 = 3;
    if (i1 === 0) break go100;

    // ! Callsign must have a suffix of 1-3 letters
    if (i1 === nbc) break go100;
    let n = 0;
    for (let i = i1 + 1; i <= nbc; i++) {
      const j = ichar(bc[i - 1]);
      if (j < ichar('A') || j > ichar('Z')) break go100;
      n = n + 1;
    }
    if (n >= 1 && n <= 3) return { bc, ok: true }; // go to 200
  }
  // chkcall.f90:100
  return { bc, ok: false };
}

// subroutine fmtmsg(msg,iz)
// fmtmsg.f90:1
// msg is character*(*); `len` gives its declared length (ft8code uses
// character*37). Returns the result with trailing blanks removed.
export function fmtmsg(msgIn, len = 37) {
  let msg = fstr(msgIn, len);
  // ! Convert all letters to upper case
  let iz = msg.length;
  const nloop = iz; // DO trip count is fixed at loop start
  for (let i = 1; i <= nloop; i++) {
    if (msg[i - 1] >= 'a' && msg[i - 1] <= 'z') {
      msg = setSub(msg, i, i, char(ichar(msg[i - 1]) + ichar('A') - ichar('a')));
    }
    if (msg[i - 1] !== ' ') iz = i;
  }

  for (let iter = 1; iter <= 37; iter++) {
    // !Collapse multiple blanks into one
    const ib2 = findex(sub(msg, 1, iz), '  ');
    if (ib2 < 1) break; // go to 100
    msg = fstr(sub(msg, 1, ib2) + subFrom(msg, ib2 + 2), len);
    iz = iz - 1;
  }
  // fmtmsg.f90:100
  return trimF(msg);
}

// ---------------------------------------------------------------------------
// module packjt77
// ---------------------------------------------------------------------------

export class PackJT77 {
  constructor() {
    this.reset();
  }

  // Fresh module state, like a newly started WSJT-X.
  reset() {
    // packjt77.f90:4-14  (module variables)
    this.calls10 = new Array(1024).fill(BLANK13); // dimension(0:1023)
    this.calls12 = new Array(4096).fill(BLANK13); // dimension(0:4095)
    this.calls22 = new Array(MAXHASH + 1).fill(BLANK13); // dimension(1:MAXHASH)
    this.recent_calls = new Array(MAXRECENT + 1).fill(BLANK13); // dimension(1:MAXRECENT)
    this.mycall13 = ''; // character (len=13)
    this.dxcall13 = ''; // character (len=13)
    this.dxbase = ''; // character (len=6)
    this.ihash22 = new Array(MAXHASH + 1).fill(-1); // dimension(1:MAXHASH)
    this.nzhash = 0;
    // FORTRAN-SEMANTICS: module variables without initialiser live in static
    // storage, which gfortran zero-fills.
    this.n28a = 0;
    this.n28b = 0;

    // save'd / data-initialised locals of unpack77 (packjt77.f90:259-264).
    // FORTRAN-SEMANTICS: hashmy*/hashdx* are SAVEd without a DATA value, so
    // they start at 0 (static storage). This is observable: type 5 compares
    // n12 with hashmy12 without checking mycall13_set.
    this.hashmy10 = 0;
    this.hashmy12 = 0;
    this.hashmy22 = 0;
    this.hashdx10 = 0;
    this.hashdx12 = 0;
    this.hashdx22 = 0;
    this.mycall13_0 = BLANK13;
    this.dxcall13_0 = BLANK13;
    this.mycall13_set = false;
    this.dxcall13_set = false;
    // mp_short_ops has save'd ii1, ii2 (byte order of the host); not needed
    // here because the multi-precision arithmetic is done with BigInt.

    this.lastUB = [];
  }

  _ub(msg) {
    this.lastUB.push(msg);
  }

  _mycall13() {
    return fstr(this.mycall13, 13);
  }

  _dxcall13() {
    return fstr(this.dxcall13, 13);
  }

  // subroutine hash10(n10,c13)
  // packjt77.f90:18
  hash10(n10) {
    let c13 = f13('<...>');
    if (n10 < 0 || n10 > 1023) return c13;
    if (lenTrim(this.calls10[n10]) > 0) {
      c13 = this.calls10[n10];
      c13 = f13('<', trimF(c13), '>');
    }
    return c13;
  }

  // subroutine hash12(n12,c13)
  // packjt77.f90:32
  hash12(n12) {
    let c13 = f13('<...>');
    if (n12 < 0 || n12 > 4095) return c13;
    if (lenTrim(this.calls12[n12]) > 0) {
      c13 = this.calls12[n12];
      c13 = f13('<', trimF(c13), '>');
    }
    return c13;
  }

  // subroutine hash22(n22,c13)
  // packjt77.f90:47
  hash22(n22) {
    let c13 = f13('<...>');
    for (let i = 1; i <= this.nzhash; i++) {
      if (this.ihash22[i] === n22) {
        c13 = this.calls22[i];
        c13 = f13('<', trimF(c13), '>');
        break; // go to 900
      }
    }
    // packjt77.f90:60
    return c13;
  }

  // subroutine save_hash_call(c13,n10,n12,n22)
  // packjt77.f90:81
  // `out` holds the caller's n10/n12/n22; like the Fortran dummy arguments
  // they are only assigned when the routine gets that far.
  _saveHashCall(c13in, out) {
    let cw = fstr(c13in, 13);
    if (cw[0] === ' ' || sub(cw, 1, 5) === '<...>') return;
    if (cw[0] === '<') cw = fstr(subFrom(cw, 2), 13);
    const i = findex(cw, '>');
    if (i > 0) cw = setSub(cw, i, 13, '         ');

    if (lenTrim(cw) < 3) return;

    const mycall13 = this._mycall13();
    const n10 = ihashcall(cw, 10);
    out.n10 = n10;
    if (n10 >= 0 && n10 <= 1023 && !feq(cw, mycall13)) this.calls10[n10] = cw;

    const n12 = ihashcall(cw, 12);
    out.n12 = n12;
    if (n12 >= 0 && n12 <= 4095 && !feq(cw, mycall13)) this.calls12[n12] = cw;

    const n22 = ihashcall(cw, 22);
    out.n22 = n22;
    let any = false;
    for (let k = 1; k <= MAXHASH; k++) {
      if (this.ihash22[k] === n22) any = true;
    }
    if (any) {
      // ! If entry exists, make sure callsign is the most recently received one
      for (let k = 1; k <= MAXHASH; k++) {
        if (this.ihash22[k] === n22) this.calls22[k] = cw;
      }
      return; // go to 900
    }

    // ! New entry: move table down, making room for new one at the top
    for (let k = MAXHASH; k >= 2; k--) this.ihash22[k] = this.ihash22[k - 1];

    // ! Add the new entry
    for (let k = MAXHASH; k >= 2; k--) this.calls22[k] = this.calls22[k - 1];
    this.ihash22[1] = n22;
    this.calls22[1] = cw;
    if (this.nzhash < MAXHASH) this.nzhash = this.nzhash + 1;
    // packjt77.f90:113 (900 continue)
  }

  // Public wrapper: -> { n10, n12, n22 }. A value stays undefined when the
  // Fortran routine returns early without assigning it.
  saveHashCall(call) {
    const out = { n10: undefined, n12: undefined, n22: undefined };
    this._saveHashCall(call, out);
    return out;
  }

  // subroutine pack77(msg0,i3,n3,c77)
  // packjt77.f90:117
  // i3hint/n3hint are the incoming values of the i3/n3 arguments.
  // Returns { c77, i3, n3 } (the outgoing values).
  pack77(msg0, i3hint = -1, n3hint = -1) {
    this.lastUB = [];
    // State shared by reference with the pack77_* subroutines
    // (nwords, w, i3, n3, c77 are passed by reference in the Fortran).
    // UB: c77 is intent(out) in practice but is not written on one path
    // (pack77_3, see there). The caller's previous c77 then survives; here
    // c77 starts as 77 blanks on every call.
    const st = { nwords: 0, nw: null, w: null, i3: -1, n3: -1, c77: ' '.repeat(77) };

    let msg = fstr(msg0, 37);
    if (sub(msg, 1, 3) === '$DX') {
      const i1 = findex(msg, ' ');
      msg = f37(trimF(fstr(this.dxbase, 6)), ' ', subFrom(msg, i1 + 1));
    }

    const i3_hint = i3hint;
    const n3_hint = n3hint;
    st.i3 = -1;
    st.n3 = -1;
    const result = () => ({ c77: st.c77, i3: st.i3, n3: st.n3 });

    let label;
    let viaHint5 = false;
    if (i3_hint === 0 && n3_hint === 5) {
      label = 5; // go to 5
      viaHint5 = true;
    } else {
      // ! Convert msg to upper case; collapse multiple blanks; parse into words.
      const s = this.split77(msg);
      msg = s.msg;
      st.nwords = s.nwords;
      st.nw = s.nw;
      st.w = s.w;
      if (sub(msg, 1, 3) === 'CQ ' || sub(msg, 1, 3) === 'DE ' || sub(msg, 1, 4) === 'QRZ ') {
        label = 100; // go to 100
      } else {
        // ! Check 0.1 (DXpedition mode)
        this.pack77_01(st);
        if (st.i3 >= 0 || st.n3 >= 1) return result(); // go to 900
        // ! Check 0.2 (EU VHF contest exchange)
        // !  call pack77_02(nwords,w,i3,n3,c77)
        // !  if(i3.ge.0) go to 900

        // ! Check 0.3 and 0.4 (ARRL Field Day exchange)
        this.pack77_03(st);
        if (st.i3 >= 0) return result(); // go to 900
        if (st.nwords >= 2) label = 100;
        else label = 5;
      }
    }

    if (label === 5) {
      // ! Check 0.5 (telemetry)
      // packjt77.f90:156 (label 5)
      const i0 = findex(msg, ' ');
      let c18 = fstr(sub(msg, 1, i0 - 1), 18);
      c18 = adjustr(c18);
      const ntel = [null, -99, -99, -99];
      // read(c18,1005,err=6) ntel   1005 format(3z6)
      let readErr = false;
      for (let k = 1; k <= 3; k++) {
        const r = readZField(sub(c18, 6 * k - 5, 6 * k));
        if (!r.ok) {
          readErr = true; // err=6; elements already read keep their value
          break;
        }
        ntel[k] = r.v;
      }
      if (!readErr && ntel[1] >= 2 ** 23) {
        label = 800; // go to 800
      } else {
        // packjt77.f90:163 (label 6)
        if (ntel[1] >= 0 && ntel[2] >= 0 && ntel[3] >= 0) {
          st.i3 = 0;
          st.n3 = 5;
          // write(c77,1006) ntel,n3,i3   1006 format(b23.23,2b24.24,2b3.3)
          st.c77 =
            fmtB(ntel[1], 23, 23) + fmtB(ntel[2], 24, 24) + fmtB(ntel[3], 24, 24) +
            fmtB(st.n3, 3, 3) + fmtB(st.i3, 3, 3);
          return result(); // go to 900
        }
        label = 100;
        if (viaHint5) {
          // UB: with i3_hint=0,n3_hint=5 split77 was skipped, so nwords and
          // w are uninitialised when execution falls through to 100.
          this._ub('packjt77.f90:171 nwords/w uninitialised after i3=0,n3=5 hint; JS assumes nwords=0, w blank');
          st.nwords = 0;
          st.w = new Array(20).fill(BLANK13);
        }
      }
    }

    if (label === 100) {
      // packjt77.f90:171 (label 100)
      this.pack77_06(st, i3_hint, n3_hint);
      if (st.i3 >= 0) return result();

      // ! Check Type 1 (Standard 77-bit message) or Type 2, with optional "/P"
      this.pack77_1(st);
      if (st.i3 >= 0) return result();

      // ! Check Type 3 (ARRL RTTY contest exchange)
      this.pack77_3(st);
      if (st.i3 >= 0) return result();

      // ! Check Type 4 (One nonstandard call and one hashed call)
      this.pack77_4(st);
      if (st.i3 >= 0) return result();

      // ! Check Type 5 (EU VHF Contest with 2 hashed calls, report, serial, and grid6)
      this.pack77_5(st);
      if (st.i3 >= 0) return result();
    }

    // ! It defaults to free text
    // packjt77.f90:191 (label 800)
    st.i3 = 0;
    st.n3 = 0;
    msg = setSub(msg, 14, 37, '                        ');
    const c71 = this.packtext77(sub(msg, 1, 13));
    st.c77 = c71 + fmtB(st.n3, 3, 3) + fmtB(st.i3, 3, 3); // write(c77(72:77),'(2b3.3)') n3,i3

    // packjt77.f90:197 (label 900)
    return result();
  }

  // subroutine unpack77(c77,nrx,msg,unpk77_success)
  // packjt77.f90:200
  // !
  // ! nrx=1 when unpacking a received message
  // ! nrx=0 when unpacking a to-be-transmitted message
  // ! the value of nrx is used to decide when mycall13 or dxcall13 should
  // ! be used in place of a callsign from the hashtable
  // !
  // Returns { msg, success }, msg with trailing blanks removed.
  unpack77(c77in, nrx) {
    this.lastUB = [];
    const c77 = fstr(c77in, 77);
    const mycall13 = this._mycall13();
    const dxcall13 = this._dxcall13();
    let msg; // character*37
    let unpk77_success;
    let grid4 = null; // character*4, uninitialised
    let grid6 = null; // character*6, uninitialised
    const ret = () => ({ msg: trimF(msg), success: unpk77_success });

    if (!feq(mycall13, this.mycall13_0)) {
      if (lenTrim(mycall13) > 2) {
        this.mycall13_set = true;
        this.mycall13_0 = mycall13;
        const out = { n10: this.hashmy10, n12: this.hashmy12, n22: this.hashmy22 };
        this._saveHashCall(mycall13, out);
        this.hashmy10 = out.n10;
        this.hashmy12 = out.n12;
        this.hashmy22 = out.n22;
      } else {
        this.mycall13_set = false;
      }
    }

    if (!feq(dxcall13, this.dxcall13_0)) {
      if (lenTrim(dxcall13) > 2) {
        this.dxcall13_set = true;
        this.dxcall13_0 = dxcall13;
        this.hashdx10 = ihashcall(dxcall13, 10);
        this.hashdx12 = ihashcall(dxcall13, 12);
        this.hashdx22 = ihashcall(dxcall13, 22);
      }
    }
    unpk77_success = true;

    // ! Check for bad data
    for (let i = 1; i <= 77; i++) {
      if (c77[i - 1] !== '0' && c77[i - 1] !== '1') {
        msg = f37('failed unpack');
        unpk77_success = false;
        return ret();
      }
    }

    let [n3, i3] = readB(sub(c77, 72, 77), [3, 3]); // read(c77(72:77),'(2b3)') n3,i3
    msg = ' '.repeat(37);

    if (i3 === 0 && n3 === 0) {
      // ! 0.0  Free text
      msg = setSub(msg, 1, 13, this.unpacktext77(sub(c77, 1, 71)));
      msg = setSub(msg, 14, 37, '                        ');
      msg = adjustl(msg);
      if (msg[0] === ' ') {
        unpk77_success = false;
        return ret();
      }
    } else if (i3 === 0 && n3 === 1) {
      // ! 0.1  K1ABC RR73; W9XYZ <KH1/KH7Z> -11   28 28 10 5       71   DXpedition Mode
      const v = readB(c77, [28, 28, 10, 5]); // 1010 format(2b28,b10,b5)
      this.n28a = v[0];
      this.n28b = v[1];
      const n10 = v[2];
      const n5 = v[3];
      const irpt = 2 * n5 - 30;
      let crpt = fmtI(irpt, 3, 2); // 1012 format(i3.2)
      if (irpt >= 0) crpt = setSub(crpt, 1, 1, '+');
      let r = this.unpack28(this.n28a);
      const call_1 = r.call;
      if (!r.success || this.n28a <= 2) unpk77_success = false;
      r = this.unpack28(this.n28b);
      const call_2 = r.call;
      if (!r.success || this.n28b <= 2) unpk77_success = false;
      let call_3 = this.hash10(n10);
      if (nrx === 1 && this.dxcall13_set && this.hashdx10 === n10) call_3 = f13('<', trimF(dxcall13), '>');
      if (nrx === 0 && this.mycall13_set && n10 === this.hashmy10) call_3 = f13('<', trimF(mycall13), '>');
      msg = f37(trimF(call_1), ' RR73; ', trimF(call_2), ' ', trimF(call_3), ' ', crpt);
    } else if (i3 === 0 && n3 === 2) {
      unpk77_success = false;
    } else if (i3 === 0 && (n3 === 3 || n3 === 4)) {
      // ! 0.3   WA9XYZ KA1ABC R 16A EMA            28 28 1 4 3 7    71   ARRL Field Day
      // ! 0.4   WA9XYZ KA1ABC R 32A EMA            28 28 1 4 3 7    71   ARRL Field Day
      const v = readB(c77, [28, 28, 1, 4, 3, 7]); // 1030 format(2b28,b1,b4,b3,b7)
      this.n28a = v[0];
      this.n28b = v[1];
      const ir = v[2];
      const intx = v[3];
      const nclass = v[4];
      let isec = v[5];
      if (isec > NSEC || isec < 1) {
        unpk77_success = false;
        isec = 1;
      }
      let r = this.unpack28(this.n28a);
      const call_1 = r.call;
      if (!r.success || this.n28a <= 2) unpk77_success = false;
      r = this.unpack28(this.n28b);
      const call_2 = r.call;
      if (!r.success || this.n28b <= 2) unpk77_success = false;
      let ntx = intx + 1;
      if (n3 === 4) ntx = ntx + 16;
      let cntx = fmtI(ntx, 2); // write(cntx(1:2),1032) ntx   1032 format(i2)
      cntx = cntx + char(ichar('A') + nclass); // cntx(3:3)=...
      if (ir === 0 && ntx < 10) msg = f37(trimF(call_1), ' ', trimF(call_2), cntx, ' ', CSEC[isec]);
      if (ir === 1 && ntx < 10) msg = f37(trimF(call_1), ' ', trimF(call_2), ' R', cntx, ' ', CSEC[isec]);
      if (ir === 0 && ntx >= 10) msg = f37(trimF(call_1), ' ', trimF(call_2), ' ', cntx, ' ', CSEC[isec]);
      if (ir === 1 && ntx >= 10) msg = f37(trimF(call_1), ' ', trimF(call_2), ' R ', cntx, ' ', CSEC[isec]);
    } else if (i3 === 0 && n3 === 5) {
      // ! 0.5   0123456789abcdef01                 71               71   Telemetry (18 hex)
      const ntel = readB(c77, [23, 24, 24]); // 1006 format(b23,2b24)
      msg = f37(fmtZ(ntel[0], 6, 6), fmtZ(ntel[1], 6, 6), fmtZ(ntel[2], 6, 6)); // 1007 format(3z6.6)
      for (let i = 1; i <= 18; i++) {
        if (msg[i - 1] !== '0') break;
        msg = setSub(msg, i, i, ' ');
      }
      msg = adjustl(msg);
    } else if (i3 === 0 && n3 === 6) {
      const [j48, j49, j50] = readB(sub(c77, 48, 50), [1, 1, 1]);
      // ! bits 48:50
      // ! itype=1: x00
      // ! itype=2: xx1
      // ! itype=3: 010
      let itype;
      if (j50 === 1) {
        itype = 2;
      } else if (j49 === 0) {
        itype = 1;
      } else if (j48 === 0) {
        itype = 3;
      } else {
        itype = -1;
        unpk77_success = false;
      }

      if (itype === 1) {
        // ! WSPR Type 1
        let [n28, igrid4, idbm] = readB(c77, [28, 15, 5]); // 2010 format(b28.28,b15.15,b5.5)
        // FORTRAN-SEMANTICS: idbm*10.0/3.0 is evaluated in real(4).
        idbm = nint(Math.fround(Math.fround(idbm * 10) / 3));
        if (idbm < 0 || idbm > 60) unpk77_success = false;
        const r = this.unpack28(n28);
        const call_1 = r.call;
        if (!r.success) unpk77_success = false;
        const g = this.toGrid4(igrid4);
        if (g.ok) grid4 = g.grid4;
        if (!g.ok) unpk77_success = false;
        if (grid4 === null) {
          this._ub('packjt77.f90:400 grid4 uninitialised (to_grid4 failed); JS assumes blanks');
          grid4 = '    ';
        }
        const crpt = fmtI(idbm, 3); // write(crpt,'(i3)') idbm
        msg = f37(trimF(call_1), ' ', grid4, ' ', trimF(adjustl(crpt)));
        if (unpk77_success) this._saveHashCall(call_1, {}); // !### Is this OK here? ###
      } else if (itype === 2) {
        // ! WSPR Type 2
        let [n28, npfx, idbm] = readB(c77, [28, 16, 5]); // 2020 format(b28.28,b16.16,b5.5)
        idbm = nint(Math.fround(Math.fround(idbm * 10) / 3));
        if (idbm < 0 || idbm > 60) unpk77_success = false;
        const r = this.unpack28(n28);
        const call_1 = r.call;
        if (!r.success) unpk77_success = false;
        const crpt = fmtI(idbm, 3); // write(crpt,'(i3)') idbm
        let cpfx = '   ';
        if (npfx < NZZZ) {
          // ! Prefix
          for (let i = 3; i >= 1; i--) {
            const j = (npfx % 36) + 1;
            cpfx = setSub(cpfx, i, i, sub(A2, j, j));
            npfx = Math.trunc(npfx / 36);
            if (npfx === 0) break;
          }
          msg = f37(trimF(adjustl(cpfx)), '/', trimF(call_1), ' ', trimF(adjustl(crpt)));
          const call_1a = f13(trimF(adjustl(cpfx)), '/', trimF(call_1));
          this._saveHashCall(call_1a, {}); // !### Is this OK here? ###
        } else {
          // ! Suffix
          npfx = npfx - NZZZ;
          if (npfx <= 35) {
            cpfx = setSub(cpfx, 1, 1, sub(A2, npfx + 1, npfx + 1));
          } else if (npfx > 35 && npfx <= 1295) {
            const a = Math.trunc(npfx / 36) + 1;
            const b = (npfx % 36) + 1;
            cpfx = setSub(cpfx, 1, 1, sub(A2, a, a));
            cpfx = setSub(cpfx, 2, 2, sub(A2, b, b));
          } else if (npfx > 1295 && npfx <= 12959) {
            const a = Math.trunc(npfx / 360) + 1;
            const b = (Math.trunc(npfx / 10) % 36) + 1;
            const c = (npfx % 10) + 1;
            cpfx = setSub(cpfx, 1, 1, sub(A2, a, a));
            cpfx = setSub(cpfx, 2, 2, sub(A2, b, b));
            cpfx = setSub(cpfx, 3, 3, sub(A2, c, c));
          } else {
            unpk77_success = false;
            return ret();
          }
          msg = f37(trimF(call_1), '/', trimF(adjustl(cpfx)), ' ', trimF(adjustl(crpt)));
          const call_1a = f13(trimF(call_1), '/', trimF(adjustl(cpfx)));
          this._saveHashCall(call_1a, {}); // !### Is this OK here? ###
        }
      } else if (itype === 3) {
        // ! WSPR Type 3
        const [n22, igrid6] = readB(c77, [22, 25]); // 2030 format(b22.22,b25.25)
        const n28 = n22 + 2063592;
        const r = this.unpack28(n28);
        const call_1 = r.call;
        if (!r.success) unpk77_success = false;
        const g = this.toGrid(igrid6);
        if (g.ok) grid6 = g.grid6;
        if (!g.ok) unpk77_success = false;
        if (grid6 === null) {
          this._ub('packjt77.f90:454 grid6 uninitialised (to_grid failed); JS assumes blanks');
          grid6 = '      ';
        }
        msg = f37(trimF(call_1), ' ', grid6);
      }
    } else if (i3 === 0 && n3 > 6) {
      unpk77_success = false;
    } else if (i3 === 1 || i3 === 2) {
      // ! Type 1 (standard message) or Type 2 ("/P" form for EU VHF contest)
      const v = readB(c77, [28, 1, 28, 1, 1, 15, 3]); // 1000 format(2(b28,b1),b1,b15,b3)
      this.n28a = v[0];
      const ipa = v[1];
      this.n28b = v[2];
      const ipb = v[3];
      const ir = v[4];
      const igrid4 = v[5];
      i3 = v[6];
      let r = this.unpack28(this.n28a);
      let call_1 = r.call;
      let unpk28_success = r.success;
      if (nrx === 1 && this.mycall13_set && this.hashmy22 === this.n28a - 2063592) {
        call_1 = f13('<', trimF(mycall13), '>');
        unpk28_success = true;
      }
      if (!unpk28_success) unpk77_success = false;
      r = this.unpack28(this.n28b);
      let call_2 = r.call;
      if (!r.success) unpk77_success = false;
      if (sub(call_1, 1, 3) === 'CQ_') call_1 = setSub(call_1, 3, 3, ' ');
      if (findex(call_1, '<') <= 0) {
        const i = findex(call_1, ' ');
        if (i >= 4 && ipa === 1 && i3 === 1) call_1 = setSub(call_1, i, i + 1, '/R');
        if (i >= 4 && ipa === 1 && i3 === 2) call_1 = setSub(call_1, i, i + 1, '/P');
        if (i >= 4) this.addCallToRecentCalls(call_1);
      }
      if (findex(call_2, '<') <= 0) {
        const i = findex(call_2, ' ');
        if (i >= 4 && ipb === 1 && i3 === 1) call_2 = setSub(call_2, i, i + 1, '/R');
        if (i >= 4 && ipb === 1 && i3 === 2) call_2 = setSub(call_2, i, i + 1, '/P');
        if (i >= 4) {
          this.addCallToRecentCalls(call_2);
          // ! only hash the "from" call
          this._saveHashCall(call_2, {});
        }
      }
      if (igrid4 <= MAXGRID4) {
        const g = this.toGrid4(igrid4);
        if (g.ok) grid4 = g.grid4;
        if (!g.ok) unpk77_success = false;
        if (grid4 === null) {
          this._ub('packjt77.f90:492 grid4 uninitialised (to_grid4 failed); JS assumes blanks');
          grid4 = '    ';
        }
        if (ir === 0) msg = f37(trimF(call_1), ' ', trimF(call_2), ' ', grid4);
        if (ir === 1) msg = f37(trimF(call_1), ' ', trimF(call_2), ' R ', grid4);
        if (sub(msg, 1, 3) === 'CQ ' && ir === 1) unpk77_success = false;
      } else {
        const irpt = igrid4 - MAXGRID4;
        if (irpt === 1) msg = f37(trimF(call_1), ' ', trimF(call_2));
        if (irpt === 2) msg = f37(trimF(call_1), ' ', trimF(call_2), ' RRR');
        if (irpt === 3) msg = f37(trimF(call_1), ' ', trimF(call_2), ' RR73');
        if (irpt === 4) msg = f37(trimF(call_1), ' ', trimF(call_2), ' 73');
        if (irpt >= 5) {
          let isnr = irpt - 35;
          if (isnr > 50) isnr = isnr - 101;
          let crpt = fmtI(isnr, 3, 2); // write(crpt,'(i3.2)') isnr
          if (crpt[0] === ' ') crpt = setSub(crpt, 1, 1, '+');
          if (ir === 0) msg = f37(trimF(call_1), ' ', trimF(call_2), ' ', crpt);
          if (ir === 1) msg = f37(trimF(call_1), ' ', trimF(call_2), ' R', crpt);
        }
        if (sub(msg, 1, 3) === 'CQ ' && irpt >= 2) unpk77_success = false;
      }
    } else if (i3 === 3) {
      // ! Type 3: ARRL RTTY Contest
      const v = readB(c77, [1, 28, 28, 1, 3, 13, 3]); // 1040 format(b1,2b28.28,b1,b3.3,b13.13,b3.3)
      const itu = v[0];
      this.n28a = v[1];
      this.n28b = v[2];
      const ir = v[3];
      const irpt = v[4];
      const nexch = v[5];
      i3 = v[6];
      const crpt = '5' + fmtI(irpt + 2, 1) + '9'; // 1042 format('5',i1,'9')
      let nserial = nexch;
      let imult = -1;
      if (nexch > 8000) {
        imult = nexch - 8000;
        nserial = -1;
      }
      let r = this.unpack28(this.n28a);
      const call_1 = r.call;
      if (!r.success) unpk77_success = false;
      r = this.unpack28(this.n28b);
      const call_2 = r.call;
      if (!r.success) unpk77_success = false;
      imult = 0;
      nserial = 0;
      if (nexch > 8000) imult = nexch - 8000;
      if (nexch < 8000) nserial = nexch;

      if (imult >= 1 && imult <= NUSCAN) {
        if (itu === 0 && ir === 0) msg = f37(trimF(call_1), ' ', trimF(call_2), ' ', crpt, ' ', CMULT[imult]);
        if (itu === 1 && ir === 0) msg = f37('TU; ', trimF(call_1), ' ', trimF(call_2), ' ', crpt, ' ', CMULT[imult]);
        if (itu === 0 && ir === 1) msg = f37(trimF(call_1), ' ', trimF(call_2), ' R ', crpt, ' ', CMULT[imult]);
        if (itu === 1 && ir === 1) msg = f37('TU; ', trimF(call_1), ' ', trimF(call_2), ' R ', crpt, ' ', CMULT[imult]);
      } else if (nserial >= 1 && nserial <= 7999) {
        const cserial = fmtI(nserial, 4, 4); // write(cserial,'(i4.4)') nserial
        if (itu === 0 && ir === 0) msg = f37(trimF(call_1), ' ', trimF(call_2), ' ', crpt, ' ', cserial);
        if (itu === 1 && ir === 0) msg = f37('TU; ', trimF(call_1), ' ', trimF(call_2), ' ', crpt, ' ', cserial);
        if (itu === 0 && ir === 1) msg = f37(trimF(call_1), ' ', trimF(call_2), ' R ', crpt, ' ', cserial);
        if (itu === 1 && ir === 1) msg = f37('TU; ', trimF(call_1), ' ', trimF(call_2), ' R ', crpt, ' ', cserial);
      }
    } else if (i3 === 4) {
      // ! Type 4
      const v = readB(c77, [12, 58, 1, 2, 1]); // 1050 format(b12,b58,b1,b2,b1)
      const n12 = v[0];
      let n58 = v[1]; // integer*8 (BigInt)
      const iflip = v[2];
      const nrpt = v[3];
      const icq = v[4];
      const c11a = new Array(11);
      for (let i = 11; i >= 1; i--) {
        const j = Number(n58 % 38n) + 1;
        c11a[i - 1] = sub(C38, j, j);
        n58 = n58 / 38n;
      }
      const c11 = c11a.join('');
      const call_3 = this.hash12(n12);
      let call_1;
      let call_2;
      if (iflip === 0) {
        // ! 12 bit hash for TO call
        call_1 = call_3;
        call_2 = f13(adjustl(c11), '  ');
        this.addCallToRecentCalls(call_2);
        this._saveHashCall(call_2, {});
        if (nrx === 1 && this.dxcall13_set && this.mycall13_set && feq(call_2, dxcall13) && n12 === this.hashmy12) {
          call_1 = f13('<', trimF(mycall13), '>');
        }
        if (nrx === 1 && this.mycall13_set && findex(call_1, '<...>') > 0 && n12 === this.hashmy12) {
          call_1 = f13('<', trimF(mycall13), '>');
        }
      } else {
        // ! 12 bit hash for DE call
        call_1 = f13(adjustl(c11));
        call_2 = call_3;
        this.addCallToRecentCalls(call_1);
        if (nrx === 0 && this.mycall13_set && n12 === this.hashmy12) call_2 = f13('<', trimF(mycall13), '>');
      }
      if (icq === 0) {
        if (nrpt === 0) msg = f37(trimF(call_1), ' ', trimF(call_2));
        if (nrpt === 1) msg = f37(trimF(call_1), ' ', trimF(call_2), ' RRR');
        if (nrpt === 2) msg = f37(trimF(call_1), ' ', trimF(call_2), ' RR73');
        if (nrpt === 3) msg = f37(trimF(call_1), ' ', trimF(call_2), ' 73');
      } else {
        msg = f37('CQ ', trimF(call_2));
      }
    } else if (i3 === 5) {
      // ! Type 5  <PA3XYZ> <G4ABC/P> R 590003 IO91NP      h12 h22 r1 s3 S11 g25
      // ! EU VHF contest
      const v = readB(c77, [12, 22, 1, 3, 11, 25]); // 1060 format(b12,b22,b1,b3,b11,b25)
      const n12 = v[0];
      const n22 = v[1];
      const ir = v[2];
      const irpt = v[3];
      const iserial = v[4];
      const igrid6 = v[5];
      if (igrid6 < 0 || igrid6 > 18662399) {
        unpk77_success = false;
        return ret();
      }
      let call_1 = this.hash12(n12);
      if (n12 === this.hashmy12) call_1 = f13('<', trimF(mycall13), '>');
      const call_2 = this.hash22(n22);
      const nrs = 52 + irpt;
      const cexch = fmtI(nrs, 2) + fmtI(iserial, 4, 4); // 1022 format(i2,i4.4)
      const g = this.toGrid6(igrid6); // call to_grid6(igrid6,grid6,unpk77_success)
      unpk77_success = g.ok;
      if (g.ok) grid6 = g.grid6;
      if (grid6 === null) {
        // not reachable: igrid6 was range-checked above
        this._ub('packjt77.f90:610 grid6 uninitialised (to_grid6 failed); JS assumes blanks');
        grid6 = '      ';
      }
      if (ir === 0) msg = f37(trimF(call_1), ' ', trimF(call_2), ' ', cexch, ' ', grid6);
      if (ir === 1) msg = f37(trimF(call_1), ' ', trimF(call_2), ' R ', cexch, ' ', grid6);
    } else if (i3 >= 6) {
      // ! i3 values 6 and 7 are not yet defined
      unpk77_success = false;
    }
    if (sub(msg, 1, 4) === 'CQ <') unpk77_success = false;

    return ret();
  }

  // subroutine pack28(c13,n28)
  // packjt77.f90:621
  // ! Pack a special token, a 22-bit hash code, or a valid base call into a 28-bit
  // ! integer.
  // Returns { n28, c13 }: c13 is the dummy argument, which this routine
  // modifies in the <...> branch (the caller's actual argument changes too).
  _pack28(c13in) {
    let c13 = fstr(c13in, 13);
    let n28 = -1;
    let callsign; // character*6, uninitialised
    const is_digit = isDigitC;
    const is_letter = isLetterC;

    // ! Work-around for Swaziland prefix:
    if (sub(c13, 1, 4) === '3DA0') callsign = fstr('3D0' + sub(c13, 5, 7), 6);
    // ! Work-around for Guinea prefixes:
    if (sub(c13, 1, 2) === '3X' && c13[2] >= 'A' && c13[2] <= 'Z') callsign = fstr('Q' + sub(c13, 3, 6), 6);
    // (Both work-arounds are dead code in 2.7.0: `callsign` is overwritten
    // below before it is used, and only on the standard-call path.)

    go900: {
      // ! Check for special tokens first
      if (sub(c13, 1, 3) === 'DE ') {
        n28 = 0;
        break go900;
      }

      if (sub(c13, 1, 4) === 'QRZ ') {
        n28 = 1;
        break go900;
      }

      if (sub(c13, 1, 3) === 'CQ ') {
        n28 = 2;
        break go900;
      }

      if (sub(c13, 1, 3) === 'CQ_') {
        const n = lenTrim(c13);
        if (n >= 4 && n <= 7) {
          let nlet = 0;
          let nnum = 0;
          for (let i = 4; i <= n; i++) {
            const c = c13[i - 1];
            if (c >= 'A' && c <= 'Z') nlet = nlet + 1;
            if (c >= '0' && c <= '9') nnum = nnum + 1;
          }
          if (nnum === 3 && nlet === 0) {
            // read(c13(4:3+nnum),*) nqsy    (no ERR=/END=: errors abort)
            const r = listReadInt(sub(c13, 4, 3 + nnum));
            if (r.st === LR_ERR) throw new FortranRuntimeError('Bad integer for item 1 in list input', 'packjt77.f90:678');
            if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', 'packjt77.f90:678');
            let nqsy;
            if (r.st === LR_OK) {
              nqsy = r.v;
            } else {
              this._ub('packjt77.f90:678 nqsy uninitialised (null value read); JS assumes 0');
              nqsy = 0;
            }
            n28 = (3 + nqsy) | 0;
            break go900;
          }
          if (nlet >= 1 && nlet <= 4 && nnum === 0) {
            let c4 = fstr(sub(c13, 4, n), 4);
            c4 = adjustr(c4);
            let m = 0;
            for (let i = 1; i <= 4; i++) {
              let j = 0;
              const c = c4[i - 1];
              if (c >= 'A' && c <= 'Z') j = ichar(c) - ichar('A') + 1;
              m = 27 * m + j;
            }
            n28 = 3 + 1000 + m;
            break go900;
          }
        }
      }

      // ! Check for <...> callsign
      if (c13[0] === '<') {
        this._saveHashCall(c13, {}); // !Save callsign in hash table
        const i2 = findex(c13, '>');
        c13 = fstr(sub(c13, 2, i2 - 1), 13);
        const n22 = ihashcall(c13, 22);
        n28 = NTOKENS + n22;
        break go900;
      }

      // ! Check for standard callsign
      let iarea = -1;
      let n = lenTrim(c13);
      let i;
      for (i = n; i >= 2; i--) {
        if (is_digit(c13[i - 1])) break;
      }
      // FORTRAN-SEMANTICS: after a completed `do i=n,2,-1` i is 1; after a
      // zero-trip loop (n<2) i is n. The JS for-loop leaves the same value.
      iarea = i; // !Call-area digit
      let npdig = 0; // !Digits before call area
      let nplet = 0; // !Letters before call area
      for (let k = 1; k <= iarea - 1; k++) {
        if (is_digit(c13[k - 1])) npdig = npdig + 1;
        if (is_letter(c13[k - 1])) nplet = nplet + 1;
      }
      let nslet = 0;
      for (let k = iarea + 1; k <= n; k++) {
        if (is_letter(c13[k - 1])) nslet = nslet + 1;
      }
      if (iarea < 2 || iarea > 3 || nplet === 0 || npdig >= iarea - 1 || nslet > 3) {
        // ! Treat this as a nonstandard callsign: compute its 22-bit hash
        this._saveHashCall(c13, {}); // !Save callsign in hash table
        const n22 = ihashcall(c13, 22);
        n28 = NTOKENS + n22;
        break go900;
      }

      n = lenTrim(c13);
      // ! This is a standard callsign
      this._saveHashCall(c13, {}); // !Save callsign in hash table
      if (iarea === 2) callsign = fstr(' ' + sub(c13, 1, 5), 6);
      if (iarea === 3) callsign = sub(c13, 1, 6);
      const i1 = findex(A1, callsign[0]) - 1;
      const i2 = findex(A2, callsign[1]) - 1;
      const i3 = findex(A3, callsign[2]) - 1;
      const i4 = findex(A4, callsign[3]) - 1;
      const i5 = findex(A4, callsign[4]) - 1;
      const i6 = findex(A4, callsign[5]) - 1;
      n28 = 36 * 10 * 27 * 27 * 27 * i1 + 10 * 27 * 27 * 27 * i2 + 27 * 27 * 27 * i3 + 27 * 27 * i4 + 27 * i5 + i6;
      n28 = n28 + NTOKENS + MAX22;
    }

    // packjt77.f90:749 (label 900)
    n28 = n28 & ((1 << 28) - 1); // iand(n28,ishft(1,28)-1)
    return { n28, c13 };
  }

  // Public wrapper: pack28(c13) -> n28
  pack28(c13) {
    return this._pack28(c13).n28;
  }

  // subroutine unpack28(n28_0,c13,success)
  // packjt77.f90:754
  // Returns { call, success }; call is the character*13 value (blank padded).
  unpack28(n28_0) {
    let success = true;
    let n28 = n28_0;
    let c13;

    go900: {
      if (n28 < NTOKENS) {
        // ! Special tokens DE, QRZ, CQ, CQ_nnn, CQ_aaaa
        if (n28 === 0) c13 = 'DE           ';
        if (n28 === 1) c13 = 'QRZ          ';
        if (n28 === 2) c13 = 'CQ           ';
        if (n28 <= 2) break go900;
        if (n28 <= 1002) {
          c13 = f13('CQ_', fmtI(n28 - 3, 3, 3)); // 1002 format('CQ_',i3.3)
          break go900;
        }
        if (n28 <= 532443) {
          let n = n28 - 1003;
          const i1 = Math.trunc(n / (27 * 27 * 27));
          n = n - 27 * 27 * 27 * i1;
          const i2 = Math.trunc(n / (27 * 27));
          n = n - 27 * 27 * i2;
          const i3 = Math.trunc(n / 27);
          const i4 = n - 27 * i3;
          c13 = f13(sub(A4, i1 + 1, i1 + 1), sub(A4, i2 + 1, i2 + 1), sub(A4, i3 + 1, i3 + 1), sub(A4, i4 + 1, i4 + 1));
          c13 = adjustl(c13);
          c13 = f13('CQ_', sub(c13, 1, 10));
          break go900;
        }
      }
      n28 = n28 - NTOKENS;
      if (n28 < MAX22) {
        // ! This is a 22-bit hash of a callsign
        const n22 = n28;
        c13 = this.hash22(n22); // !Retrieve callsign from hash table
        break go900;
      }

      // ! Standard callsign
      let n = n28 - MAX22;
      const i1 = Math.trunc(n / (36 * 10 * 27 * 27 * 27));
      n = n - 36 * 10 * 27 * 27 * 27 * i1;
      const i2 = Math.trunc(n / (10 * 27 * 27 * 27));
      n = n - 10 * 27 * 27 * 27 * i2;
      const i3 = Math.trunc(n / (27 * 27 * 27));
      n = n - 27 * 27 * 27 * i3;
      const i4 = Math.trunc(n / (27 * 27));
      n = n - 27 * 27 * i4;
      const i5 = Math.trunc(n / 27);
      const i6 = n - 27 * i5;
      c13 = f13(
        sub(A1, i1 + 1, i1 + 1), sub(A2, i2 + 1, i2 + 1), sub(A3, i3 + 1, i3 + 1),
        sub(A4, i4 + 1, i4 + 1), sub(A4, i5 + 1, i5 + 1), sub(A4, i6 + 1, i6 + 1),
      );
      c13 = adjustl(c13);
    }

    // packjt77.f90:820 (label 900)
    const i0 = findex(c13, ' ');
    if (i0 !== 0 && i0 < lenTrim(c13)) {
      c13 = f13('QU1RK');
      success = false;
    }
    return { call: c13, success };
  }

  // subroutine split77(msg,nwords,nw,w)
  // packjt77.f90:828
  // ! Convert msg to upper case; collapse multiple blanks; parse into words.
  // Returns { msg (character*37, modified in place in the Fortran), nwords,
  //           nw (1-based), w (1-based array of character*13) }.
  split77(msgIn) {
    let msg = fstr(msgIn, 37);
    const w = new Array(20).fill(BLANK13); // w='             '
    const nw = new Array(20).fill(0); // (uninitialised in Fortran; never read beyond nwords)
    let iz = lenTrim(msg);
    let j = 0;
    let k = 0;
    let n = 0;
    let c0 = ' ';
    for (let i = 1; i <= iz; i++) {
      if (ichar(msg[i - 1]) === 0) msg = setSub(msg, i, i, ' ');
      let c = msg[i - 1]; // !Single character
      if (c === ' ' && c0 === ' ') continue; // !Skip leading/repeated blanks
      if (c !== ' ' && c0 === ' ') {
        k = k + 1; // !New word
        n = 0;
      }
      j = j + 1; // !Index in msg
      n = n + 1; // !Index in word
      if (c >= 'a' && c <= 'z') c = char(ichar(c) - 32); // !Force upper case
      msg = setSub(msg, j, j, c);
      if (n <= 13) w[k] = setSub(w[k], n, n, c); // !Copy character c into word
      c0 = c;
    }
    iz = j; // !Message length
    let nwords = k; // !Number of words in msg
    go900: {
      if (nwords <= 0) break go900;
      for (let i = 1; i <= nwords; i++) {
        nw[i] = lenTrim(w[i]);
      }
      msg = setSub(msg, iz + 1, 37, '                                     ');
      if (nwords < 3) break go900;
      const { ok: ok1 } = chkcall(w[3]);
      if (ok1 && sub(w[1], 1, 3) === 'CQ ') {
        w[1] = f13('CQ_', sub(w[2], 1, 10)); // !Make "CQ " into "CQ_"
        const tmp = w.slice(3, 14); // !Move all remaining words down by one
        for (let i = 2; i <= 12; i++) w[i] = tmp[i - 2]; // w(2:12)=w(3:13)
        nwords = nwords - 1;
      }
    }
    // packjt77.f90:875 (label 900)
    return { msg, nwords, nw, w };
  }

  // subroutine pack77_01(nwords,w,i3,n3,c77)
  // packjt77.f90:879
  // ! Pack a Type 0.1 message: DXpedition mode
  // ! Example message:  "K1ABC RR73; W9XYZ <KH1/KH7Z> -11"   28 28 10 5
  pack77_01(st) {
    const w = st.w;
    const nwords = st.nwords;
    if (nwords !== 5) return; // !Must have 5 words
    if (!feq(trimF(w[2]), 'RR73;')) return; // !2nd word must be "RR73;"
    if (w[4][0] !== '<') return; // !4th word must have <...>
    if (findex(w[4], '>') < 1) return;
    let n = -99;
    // read(w(5),*,err=1) n
    const r = listReadInt(w[5]);
    if (r.st === LR_OK) n = r.v;
    else if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', 'packjt77.f90:894');
    // packjt77.f90:895 (label 1)
    if (n === -99) return; // !5th word must be a valid report
    // FORTRAN-SEMANTICS: n+30 wraps on int32 overflow (n near 2^31).
    let n5 = Math.trunc(((n + 30) | 0) / 2);
    if (n5 < 0) n5 = 0;
    if (n5 > 31) n5 = 31;
    const k1 = chkcall(w[1]);
    if (!k1.ok) return; // !1st word must be a valid basecall
    const k2 = chkcall(w[3]);
    if (!k2.ok) return; // !3rd word must be a valid basecall

    // ! Type 0.1:  K1ABC RR73; W9XYZ <KH1/KH7Z> -11   28 28 10 5       71
    st.i3 = 0;
    st.n3 = 1;
    let p = this._pack28(w[1]);
    w[1] = p.c13;
    this.n28a = p.n28;
    p = this._pack28(w[3]);
    w[3] = p.c13;
    this.n28b = p.n28;
    this._saveHashCall(w[4], {});
    const i2 = findex(w[4], '>');
    const c13 = f13(sub(w[4], 2, i2 - 1));
    const n10 = ihashcall(c13, 10);
    // 1010 format(2b28.28,b10.10,b5.5,2b3.3)
    st.c77 =
      fmtB(this.n28a, 28, 28) + fmtB(this.n28b, 28, 28) + fmtB(n10, 10, 10) + fmtB(n5, 5, 5) +
      fmtB(st.n3, 3, 3) + fmtB(st.i3, 3, 3);
    // packjt77.f90:916 (label 900)
  }

  // subroutine pack77_03(nwords,w,i3,n3,c77)
  // packjt77.f90:920
  // ! Check 0.3 and 0.4 (ARRL Field Day exchange)
  // ! Example message:  WA9XYZ KA1ABC R 16A EMA       28 28 1 4 3 7    71
  pack77_03(st) {
    const w = st.w;
    const nwords = st.nwords;
    if (nwords < 4 || nwords > 5) return;
    const k1 = chkcall(w[1]);
    const k2 = chkcall(w[2]);
    if (!k1.ok || !k2.ok) return;
    let isec = -1;
    for (let i = 1; i <= NSEC; i++) {
      if (feq(CSEC[i], sub(w[nwords], 1, 3))) {
        isec = i;
        break;
      }
    }
    if (isec === -1) return;
    if (nwords === 5 && !feq(trimF(w[3]), 'R')) return;

    let ntx = -1;
    const j = lenTrim(w[nwords - 1]) - 1;
    // read(w(nwords-1)(1:j),*,err=1,end=1) ntx   !Number of transmitters
    const r = listReadInt(sub(w[nwords - 1], 1, j));
    if (r.st === LR_OK) ntx = r.v;
    // packjt77.f90:959 (label 1)
    if (ntx < 1 || ntx > 32) return;
    const nclass = ichar(sub(w[nwords - 1], j + 1, j + 1)) - ichar('A');

    const m = lenTrim(w[nwords]); // !Length of section abbreviation
    if (m < 2 || m > 3) return;

    // ! 0.3   WA9XYZ KA1ABC R 16A EMA            28 28 1 4 3 7    71   ARRL Field Day
    // ! 0.4   WA9XYZ KA1ABC R 32A EMA            28 28 1 4 3 7    71   ARRL Field Day

    st.i3 = 0;
    st.n3 = 3; // !Type 0.3 ARRL Field Day
    let intx = ntx - 1;
    if (intx >= 16) {
      st.n3 = 4; // !Type 0.4 ARRL Field Day
      intx = ntx - 17;
    }
    let p = this._pack28(w[1]);
    w[1] = p.c13;
    this.n28a = p.n28;
    p = this._pack28(w[2]);
    w[2] = p.c13;
    this.n28b = p.n28;
    let ir = 0;
    if (sub(w[3], 1, 2) === 'R ') ir = 1;
    // 1010 format(2b28.28,b1,b4.4,b3.3,b7.7,2b3.3)
    // (nclass outside 0..7 gives '***' in the c77 text, as in the Fortran)
    st.c77 =
      fmtB(this.n28a, 28, 28) + fmtB(this.n28b, 28, 28) + fmtB(ir, 1) + fmtB(intx, 4, 4) +
      fmtB(nclass, 3, 3) + fmtB(isec, 7, 7) + fmtB(st.n3, 3, 3) + fmtB(st.i3, 3, 3);
  }

  // subroutine pack77_06(nwords,w,i3,n3,c77,i3_hint,n3_hint)
  // packjt77.f90:986
  pack77_06(st, i3_hint, n3_hint) {
    const w = st.w;
    const nwords = st.nwords;
    const is_digit = isDigitC;

    const m1 = lenTrim(w[1]);
    const m2 = lenTrim(w[2]);
    const m3 = lenTrim(w[3]);
    if (nwords === 3 && m1 >= 3 && m1 <= 6 && m2 === 4 && m3 <= 2) {
      // ! WSPR Type 1
      if (!isGrid4(sub(w[2], 1, 4))) return; // go to 900
      if (!is_digit(w[3][0])) return;
      if (m3 === 2) {
        if (!is_digit(w[3][1])) return;
      }
      st.i3 = 0;
      st.n3 = 6;
      const p = this._pack28(w[1]);
      w[1] = p.c13;
      const n28 = p.n28;
      const grid4 = sub(w[2], 1, 4);
      const k1 = (ichar(grid4[0]) - ichar('A')) * 18 * 10 * 10;
      const k2 = (ichar(grid4[1]) - ichar('A')) * 10 * 10;
      const k3 = (ichar(grid4[2]) - ichar('0')) * 10;
      const k4 = ichar(grid4[3]) - ichar('0');
      const igrid4 = k1 + k2 + k3 + k4;
      let idbm = this._readIntNoErr(w[3], 'packjt77.f90:1033', 'idbm');
      if (idbm < 0) idbm = 0;
      if (idbm > 60) idbm = 60;
      // FORTRAN-SEMANTICS: 0.3*idbm is real(4) arithmetic.
      idbm = nint(Math.fround(Math.fround(0.3) * idbm));
      // 1010 format(b28.28,b15.15,b5.5,2i1,b21.21,2b3.3)
      st.c77 =
        fmtB(n28, 28, 28) + fmtB(igrid4, 15, 15) + fmtB(idbm, 5, 5) + fmtI(0, 1) + fmtI(0, 1) +
        fmtB(0, 21, 21) + fmtB(st.n3, 3, 3) + fmtB(st.i3, 3, 3);
      return; // go to 900
    }
    if (nwords === 2 && m1 >= 5 && m1 <= 10 && m2 <= 2) {
      // ! WSPR Type 2
      const i1 = findex(w[1], '/');
      if (i1 < 2 || i1 === m1) return;
      if (!is_digit(w[2][0])) return;
      if (i1 === m1 - 3 && !is_digit(sub(w[1], m1, m1))) return;
      if (m2 === 2) {
        if (!is_digit(w[2][1])) return;
      }
      const kc = chkcall(w[1]);
      const bcall = kc.bc;
      if (!kc.ok) return;
      let npfx; // uninitialised
      if (i1 <= 4) {
        // ! We have a prefix
        npfx = findex(A2, sub(w[1], 1, 1)) - 1;
        if (i1 >= 3) npfx = 36 * npfx + findex(A2, sub(w[1], 2, 2)) - 1;
        if (i1 === 4) npfx = 36 * npfx + findex(A2, sub(w[1], 3, 3)) - 1;
      } else {
        // ! We have a suffix
        if (m1 - i1 === 1) npfx = findex(A2, sub(w[1], i1 + 1, i1 + 1)) - 1;
        if (m1 - i1 === 2) {
          npfx = 36 * (findex(A2, sub(w[1], i1 + 1, i1 + 1)) - 1) + findex(A2, sub(w[1], i1 + 2, i1 + 2)) - 1;
        }
        if (m1 - i1 === 3) {
          // ! Third character of a suffix must be a digit
          if (!is_digit(sub(w[1], i1 + 3, i1 + 3))) return;
          npfx =
            36 * 10 * (findex(A2, sub(w[1], i1 + 1, i1 + 1)) - 1) +
            10 * (findex(A2, sub(w[1], i1 + 2, i1 + 2)) - 1) +
            findex(A2, sub(w[1], i1 + 3, i1 + 3)) - 1;
        }
        if (npfx === undefined) {
          // UB: suffix longer than 3 chars leaves npfx unset.
          this._ub('packjt77.f90:1068 npfx uninitialised (suffix longer than 3 chars); JS assumes 0');
          npfx = 0;
        }
        npfx = npfx + NZZZ;
      }
      st.i3 = 0;
      st.n3 = 6;
      const n28 = this._pack28(fstr(bcall, 6) + '       ').n28; // call pack28(bcall//'       ',n28)
      let idbm = this._readIntNoErr(w[2], 'packjt77.f90:1073', 'idbm');
      if (idbm < 0) idbm = 0;
      if (idbm > 60) idbm = 60;
      idbm = nint(Math.fround(Math.fround(0.3) * idbm));
      // 1020 format(b28.28,b16.16,b5.5,i1,b21.21,2b3.3)
      st.c77 =
        fmtB(n28, 28, 28) + fmtB(npfx, 16, 16) + fmtB(idbm, 5, 5) + fmtI(1, 1) + fmtB(0, 21, 21) +
        fmtB(st.n3, 3, 3) + fmtB(st.i3, 3, 3);
      return; // go to 900
    }

    if (i3_hint === 0 && n3_hint === 6 && nwords === 2 && m1 >= 5 && m1 <= 12 && m2 <= 6) {
      // ! WSPR Type 3

      // !n3_hint=6 and i3_hint=0 is a hint that the caller wanted a
      // !50-bit encoding rather than the possible alternative n3=4 77-bit
      // !encoding
      if (findex(w[1], '<') < 1 || findex(w[1], '>') < 1) return;
      const grid6 = sub(w[2], 1, 6);
      if (!isGrid6_06(grid6)) return;
      st.i3 = 0;
      st.n3 = 6;
      const p = this._pack28(w[1]);
      w[1] = p.c13;
      const n28 = p.n28;
      const n22 = n28 - 2063592;
      const k1 = (ichar(grid6[0]) - ichar('A')) * 18 * 10 * 10 * 25 * 25;
      const k2 = (ichar(grid6[1]) - ichar('A')) * 10 * 10 * 25 * 25;
      const k3 = (ichar(grid6[2]) - ichar('0')) * 10 * 25 * 25;
      const k4 = (ichar(grid6[3]) - ichar('0')) * 25 * 25;
      let igrid6;
      if (sub(grid6, 5, 6) === '  ') {
        igrid6 = k1 + k2 + k3 + k4 + 24 * 25 + 24;
      } else {
        const k5 = (ichar(grid6[4]) - ichar('A')) * 25;
        const k6 = ichar(grid6[5]) - ichar('A');
        igrid6 = k1 + k2 + k3 + k4 + k5 + k6;
      }
      // 1030 format(b22.22,b25.25,b3.3,b21.21,2b3.3)
      st.c77 =
        fmtB(n22, 22, 22) + fmtB(igrid6, 25, 25) + fmtB(2, 3, 3) + fmtB(0, 21, 21) +
        fmtB(st.n3, 3, 3) + fmtB(st.i3, 3, 3);
    }
    // packjt77.f90:1111 (label 900)
  }

  // read(x,*) i  with no ERR=/END= (pack77_06 lines 1033 and 1073). The
  // words read there were checked to be 1-2 digits, so this never fails.
  _readIntNoErr(s, where, name) {
    const r = listReadInt(s);
    if (r.st === LR_OK) return r.v;
    if (r.st === LR_ERR) throw new FortranRuntimeError('Bad integer for item 1 in list input', where);
    if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', where);
    this._ub(`${where} ${name} uninitialised (null value read); JS assumes 0`);
    return 0;
  }

  // subroutine pack77_1(nwords,w,i3,n3,c77)
  // packjt77.f90:1115
  // ! Check Type 1 (Standard 77-bit message) and Type 2 (ditto, with a "/P" call)
  // ! Example message:  WA9XYZ/R KA1ABC/R R FN42     28 1 28 1 1 15   74
  pack77_1(st) {
    const w = st.w;
    const nwords = st.nwords;

    if (nwords < 2 || nwords > 4) return;
    const k1 = chkcall(w[1]);
    const k2 = chkcall(w[2]);
    const bcall_1 = k1.bc;
    const bcall_2 = k2.bc;
    let ok1 = k1.ok;
    let ok2 = k2.ok;
    if (sub(w[1], 1, 3) === 'DE ' || sub(w[1], 1, 3) === 'CQ_' || sub(w[1], 1, 3) === 'CQ ' || sub(w[1], 1, 4) === 'QRZ ') ok1 = true;
    if (w[1][0] === '<' && findex(w[1], '>') >= 5) ok1 = true;
    if (w[2][0] === '<' && findex(w[2], '>') >= 5) ok2 = true;
    if (!ok1 || !ok2) return;
    if (w[1][0] === '<' && findex(w[2], '/') > 0) return;
    if (w[2][0] === '<' && findex(w[1], '/') > 0) return;
    if (nwords === 2 && (!ok2 || findex(w[2], '/') >= 2)) return;

    let ir; // uninitialised until set below
    let irpt; // uninitialised for nwords=2 (only used after being overwritten)
    if (nwords !== 2) {
      // (nwords.eq.2 -> go to 10)
      const c1 = sub(w[nwords], 1, 1);
      const c2 = sub(w[nwords], 1, 2);
      if (
        !isGrid4(sub(w[nwords], 1, 4)) && c1 !== '+' && c1 !== '-' &&
        c2 !== 'R+' && c2 !== 'R-' && !feq(trimF(w[nwords]), 'RRR') &&
        !feq(trimF(w[nwords]), 'RR73') && !feq(trimF(w[nwords]), '73')
      ) return;
      if (c1 === '+' || c1 === '-') {
        ir = 0;
        // read(w(nwords),*,err=900) irpt
        const r = listReadInt(w[nwords]);
        if (r.st === LR_ERR) return; // go to 900
        if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', 'packjt77.f90:1154');
        if (r.st === LR_OK) irpt = r.v;
        if (irpt === undefined) {
          // not reachable: the word starts with a sign, so it can't be a null value
          this._ub('packjt77.f90:1154 irpt uninitialised (null value read); JS assumes 0');
          irpt = 0;
        }
        if (irpt >= -50 && irpt <= -31) irpt = irpt + 101;
        irpt = (irpt + 35) | 0; // FORTRAN-SEMANTICS: int32 wrap on overflow
      } else if (c2 === 'R+' || c2 === 'R-') {
        ir = 1;
        // read(w(nwords)(2:),*,err=900) irpt
        const r = listReadInt(subFrom(w[nwords], 2));
        if (r.st === LR_ERR) return; // go to 900
        if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', 'packjt77.f90:1159');
        if (r.st === LR_OK) irpt = r.v;
        if (irpt === undefined) {
          this._ub('packjt77.f90:1159 irpt uninitialised (null value read); JS assumes 0');
          irpt = 0;
        }
        if (irpt >= -50 && irpt <= -31) irpt = irpt + 101;
        irpt = (irpt + 35) | 0;
      } else if (feq(trimF(w[nwords]), 'RRR')) {
        ir = 0;
        irpt = 2;
      } else if (feq(trimF(w[nwords]), 'RR73')) {
        ir = 0;
        irpt = 3;
      } else if (feq(trimF(w[nwords]), '73')) {
        ir = 0;
        irpt = 4;
      }
    }

    // ! 1     WA9XYZ/R KA1ABC/R R FN42           28 1 28 1 1 15   74   Standard msg
    // ! 2     PA3XYZ/P GM4ABC/P R JO22           28 1 28 1 1 15   74   EU VHF contest

    // packjt77.f90:1176 (label 10)
    const i1psuffix = findex(w[1] + ' ', '/P ');
    const i2psuffix = findex(w[2] + ' ', '/P ');
    if (nwords === 2 || nwords === 3 || (nwords === 4 && sub(w[3], 1, 2) === 'R ')) {
      st.n3 = 0;
      st.i3 = 1; // !Type 1: Standard message, possibly with "/R"
      if (i1psuffix >= 4 || i2psuffix >= 4) st.i3 = 2; // !Type 2, with "/P"
    }
    // (otherwise i3 stays -1 and the code below still runs: it updates the
    // hash tables and writes c77 with '***' in the i3 field)
    let c13 = fstr(bcall_1, 13);
    if (sub(c13, 1, 3) === 'CQ_' || w[1][0] === '<') c13 = w[1];
    this.n28a = this._pack28(c13).n28;
    c13 = fstr(bcall_2, 13);
    if (w[2][0] === '<') c13 = w[2];
    this.n28b = this._pack28(c13).n28;
    let ipa = 0;
    let ipb = 0;
    if (i1psuffix >= 4 || findex(w[1] + ' ', '/R ') >= 4) ipa = 1;
    if (i2psuffix >= 4 || findex(w[2] + ' ', '/R ') >= 4) ipb = 1;

    const grid4 = sub(w[nwords], 1, 4);
    let igrid4;
    // Known 2.7.0 behaviour kept as-is: "RR73" passes is_grid4 and is sent
    // as the grid square RR73 (there is no irpt.ne.4 / RR73 exclusion here).
    if (isGrid4(grid4)) {
      ir = 0;
      if (feq(w[3], 'R ')) ir = 1;
      const j1 = (ichar(grid4[0]) - ichar('A')) * 18 * 10 * 10;
      const j2 = (ichar(grid4[1]) - ichar('A')) * 10 * 10;
      const j3 = (ichar(grid4[2]) - ichar('0')) * 10;
      const j4 = ichar(grid4[3]) - ichar('0');
      igrid4 = j1 + j2 + j3 + j4;
    } else {
      igrid4 = (MAXGRID4 + irpt) | 0; // (irpt undefined only for nwords=2, overwritten next)
    }
    if (nwords === 2) {
      ir = 0;
      irpt = 1;
      igrid4 = MAXGRID4 + irpt;
    }
    // 1000 format(2(b28.28,b1),b1,b15.15,b3.3)
    st.c77 =
      fmtB(this.n28a, 28, 28) + fmtB(ipa, 1) + fmtB(this.n28b, 28, 28) + fmtB(ipb, 1) + fmtB(ir, 1) +
      fmtB(igrid4, 15, 15) + fmtB(st.i3, 3, 3);
    // packjt77.f90:1214 return  (label 900 is the same return)
  }

  // subroutine pack77_3(nwords,w,i3,n3,c77)
  // packjt77.f90:1220
  // ! Check Type 3 (ARRL RTTY contest exchange)
  // ! ARRL RTTY   - US/Can: rpt state/prov      R 579 MA
  // !             - DX:     rpt serial          R 559 0013
  // ! Example message:  TU; W9XYZ K1ABC R 579 MA           1 28 28 1 3 13   74
  pack77_3(st) {
    const w = st.w;
    const nwords = st.nwords;

    if (w[1][0] === '<' && w[2][0] === '<') return; // go to 900
    if (nwords === 4 || nwords === 5 || nwords === 6) {
      let i1 = 1;
      if (feq(trimF(w[1]), 'TU;')) i1 = 2;
      const k1 = chkcall(w[i1]);
      const k2 = chkcall(w[i1 + 1]);
      if (!k1.ok || !k2.ok) return; // go to 900
      const crpt = sub(w[nwords - 1], 1, 3);
      if (findex(crpt, '-') >= 1 || findex(crpt, '+') >= 1) return; // go to 900
      let nserial; // uninitialised unless the next block runs
      if (crpt[0] === '5' && crpt[1] >= '2' && crpt[1] <= '9' && crpt[2] === '9') {
        nserial = 0;
        // read(w(nwords),*,err=1) nserial
        const r = listReadInt(w[nwords]);
        if (r.st === LR_OK) nserial = r.v;
        else if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', 'packjt77.f90:1266');
      }
      // packjt77.f90:1268 (label 1)
      const nserialUnset = nserial === undefined;
      if (nserialUnset) nserial = 0;
      let mult = '   ';
      let imult = -1;
      for (let i = 1; i <= NUSCAN; i++) {
        if (feq(CMULT[i], w[nwords])) {
          imult = i;
          mult = CMULT[i];
          break;
        }
      }
      if (nserialUnset && imult <= 0) {
        // UB: nserial is read below without having been set (the report is
        // not 5[2-9]9). gfortran leaves whatever was in that stack slot. It
        // only matters when no state/province matched: then a positive
        // garbage value would select type 3 with nexch = garbage.
        this._ub('packjt77.f90:1278 nserial uninitialised (report is not 5x9); JS assumes 0');
      }
      let nexch = 0;
      if (nserial > 0) nexch = nserial;
      if (imult > 0) nexch = 8000 + imult;
      if (!feq(mult, '   ') || nserial > 0) {
        st.i3 = 3;
        st.n3 = 0;
        let itu = 0;
        if (feq(trimF(w[1]), 'TU;')) itu = 1;
        let p = this._pack28(w[1 + itu]);
        w[1 + itu] = p.c13;
        this.n28a = p.n28;
        p = this._pack28(w[2 + itu]);
        w[2 + itu] = p.c13;
        this.n28b = p.n28;
        let ir = 0;
        if (sub(w[3 + itu], 1, 2) === 'R ') ir = 1;
        // read(w(3+itu+ir),*,err=900) irpt
        const r = listReadInt(w[3 + itu + ir]);
        if (r.st === LR_ERR) {
          // UB: returns with i3=3 already set and c77 not written; pack77
          // then returns the caller's stale c77. Here c77 keeps whatever
          // it held (77 blanks unless an earlier pack77_* wrote it).
          this._ub('packjt77.f90:1289 read error after i3=3: c77 not written (caller gets stale c77)');
          return; // go to 900
        }
        if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', 'packjt77.f90:1289');
        let irpt;
        if (r.st === LR_OK) {
          irpt = r.v;
        } else {
          this._ub('packjt77.f90:1290 irpt uninitialised (null value read); JS assumes 0');
          irpt = 0;
        }
        irpt = Math.trunc(((irpt - 509) | 0) / 10) - 2; // FORTRAN-SEMANTICS: int32 wrap
        if (irpt < 0) irpt = 0;
        if (irpt > 7) irpt = 7;
        // ! 3     TU; W9XYZ K1ABC R 579 MA             1 28 28 1 3 13       74   ARRL RTTY contest
        // ! 3     TU; W9XYZ G8ABC R 559 0013           1 28 28 1 3 13       74   ARRL RTTY (DX)
        // 1010 format(b1,2b28.28,b1,b3.3,b13.13,b3.3)
        // (nexch > 8191 gives '*************' in the c77 text, as in the Fortran)
        st.c77 =
          fmtB(itu, 1) + fmtB(this.n28a, 28, 28) + fmtB(this.n28b, 28, 28) + fmtB(ir, 1) +
          fmtB(irpt, 3, 3) + fmtB(nexch, 13, 13) + fmtB(st.i3, 3, 3);
      }
    }
    // packjt77.f90:1300 (label 900)
  }

  // subroutine pack77_4(nwords,w,i3,n3,c77)
  // packjt77.f90:1304
  // ! Check Type 4 (One nonstandard call and one hashed call)
  // ! Example message: <WA9XYZ> PJ4/KA1ABC RR73           12 58 1 2 1      74
  pack77_4(st) {
    const w = st.w;
    const nwords = st.nwords;

    let iflip = 0;
    st.i3 = -1;
    if (nwords === 2 || nwords === 3) {
      let call_1 = w[1];
      if (call_1[0] === '<') call_1 = f13(sub(w[1], 2, lenTrim(w[1]) - 1));
      let call_2 = w[2];
      if (call_2[0] === '<') call_2 = f13(sub(w[2], 2, lenTrim(w[2]) - 1));
      const k1 = chkcall(call_1);
      const k2 = chkcall(call_2);
      const bcall_1 = k1.bc;
      const bcall_2 = k2.bc;
      const ok1 = k1.ok;
      const ok2 = k2.ok;
      if (feq(call_1, bcall_1) && feq(call_2, bcall_2) && ok1 && ok2) return; // go to 900
      let icq = 0;
      if (feq(trimF(w[1]), 'CQ') || (ok1 && ok2)) {
        if (feq(trimF(w[1]), 'CQ') && lenTrim(w[2]) <= 4) return; // go to 900
        st.i3 = 4;
        st.n3 = 0;
        if (feq(trimF(w[1]), 'CQ')) icq = 1;
      }

      // Locals n10/n12/n22 of pack77_4 (uninitialised); save_hash_call only
      // assigns them when it does not return early.
      const out = { n10: undefined, n12: undefined, n22: undefined };
      let c11; // character*11, uninitialised
      if (icq === 1) {
        iflip = 0;
        out.n12 = 0;
        c11 = adjustr(sub(call_2, 1, 11));
        this._saveHashCall(w[2], out);
      } else if (w[1][0] === '<') {
        iflip = 0;
        st.i3 = 4;
        this._saveHashCall(w[1], out);
        c11 = adjustr(sub(call_2, 1, 11));
      } else if (w[2][0] === '<') {
        iflip = 1;
        st.i3 = 4;
        this._saveHashCall(w[2], out);
        c11 = adjustr(sub(call_1, 1, 11));
      }
      let n12 = out.n12;
      // UB notes are recorded only when i3 >= 0, i.e. when this c77 is what
      // pack77 returns. With i3 = -1 the c77 written below is overwritten
      // later (pack77_5 or free text), so the garbage can't be observed.
      if (c11 === undefined) {
        // UB: neither word is <hashed> and it's not CQ, but i3 may already be 4
        // (both calls valid, at least one compound, e.g. "W9XYZ K1ABC/P").
        // c11 and n12 are stack garbage in the Fortran. With c11 blank or NUL
        // the n58 field comes out all zeros either way.
        if (st.i3 >= 0) this._ub('packjt77.f90:1355 c11 uninitialised (no <call> and not CQ); JS assumes blanks');
        c11 = ' '.repeat(11);
      }
      if (n12 === undefined) {
        // UB: also reached in the <call> branches when save_hash_call returns
        // early (e.g. "<...>", or fewer than 3 chars inside the brackets).
        if (st.i3 >= 0) this._ub('packjt77.f90:1365 n12 uninitialised; JS assumes 0');
        n12 = 0;
      }
      let n58 = 0n; // integer*8
      for (let i = 1; i <= 11; i++) {
        n58 = n58 * 38n + BigInt(findex(C38, c11[i - 1]) - 1);
      }
      let nrpt = 0;
      if (feq(trimF(w[3]), 'RRR')) nrpt = 1;
      if (feq(trimF(w[3]), 'RR73')) nrpt = 2;
      if (feq(trimF(w[3]), '73')) nrpt = 3;
      if (icq === 1) {
        iflip = 0;
        nrpt = 0;
      }
      // 1010 format(b12.12,b58.58,b1,b2.2,b1,b3.3)
      let c77 =
        fmtB(n12, 12, 12) + fmtB(n58, 58, 58) + fmtB(iflip, 1) + fmtB(nrpt, 2, 2) + fmtB(icq, 1) +
        fmtB(st.i3, 3, 3);
      for (let i = 1; i <= 77; i++) {
        if (c77[i - 1] === '*') c77 = setSub(c77, i, i, '0'); // !### Clean up any illegal chars ###
      }
      st.c77 = c77;
    }
    // packjt77.f90:1372 (label 900)
  }

  // subroutine pack77_5(nwords,w,i3,n3,c77)
  // packjt77.f90:1375
  // ! Pack a Type 0.2 message: EU VHF Contest mode
  // ! Example message:  PA3XYZ/P R 590003 IO91NP           28 1 1 3 12 25
  // !                 <PA3XYZ> <G4ABC/P> R 590003 IO91NP   h10 h20 r1 s3 s12 g25
  pack77_5(st) {
    const w = st.w;
    const nwords = st.nwords;

    if (nwords < 4 || nwords > 5) return; // !nwords must be 4 or 5
    if (w[1][0] !== '<' || w[2][0] !== '<') return; // !Both calls must be hashed
    let nx = -1;
    // read(w(nwords-1),*,err=2) nx
    const r = listReadInt(w[nwords - 1]);
    if (r.st === LR_OK) nx = r.v;
    else if (r.st === LR_EOF) throw new FortranRuntimeError('End of file', 'packjt77.f90:1397');
    // packjt77.f90:1398 (label 2)
    if (nx < 520001 || nx > 594095) return; // !Exchange between 520001 - 594095
    if (!isGrid6_5(sub(w[nwords], 1, 6))) return; // !Last word must be a valid grid6

    // ! Type 0.2: <PA3XYZ> <G4ABC/P> R 590003 IO91NP     h10 h20 r1 s3 s12 g25

    st.i3 = 5;
    st.n3 = 0;

    this._saveHashCall(w[1], {});
    let i2 = findex(w[1], '>');
    let c13 = f13(sub(w[1], 2, i2 - 1));
    const n12 = ihashcall(c13, 12);

    this._saveHashCall(w[2], {});
    i2 = findex(w[2], '>');
    c13 = f13(sub(w[2], 2, i2 - 1));
    const n22 = ihashcall(c13, 22);

    let ir = 0;
    if (sub(w[3], 1, 2) === 'R ') ir = 1;
    const irpt = Math.trunc(nx / 10000) - 52;
    let iserial = nx % 10000;
    if (iserial > 2047) iserial = 2047;
    const grid6 = sub(w[nwords], 1, 6);
    const j1 = (ichar(grid6[0]) - ichar('A')) * 18 * 10 * 10 * 24 * 24;
    const j2 = (ichar(grid6[1]) - ichar('A')) * 10 * 10 * 24 * 24;
    const j3 = (ichar(grid6[2]) - ichar('0')) * 10 * 24 * 24;
    const j4 = (ichar(grid6[3]) - ichar('0')) * 24 * 24;
    const j5 = (ichar(grid6[4]) - ichar('A')) * 24;
    const j6 = ichar(grid6[5]) - ichar('A');
    const igrid6 = j1 + j2 + j3 + j4 + j5 + j6;

    // 1010 format(b12.12,b22.22,b1,b3.3,b11.11,b25.25,b3.3)
    st.c77 =
      fmtB(n12, 12, 12) + fmtB(n22, 22, 22) + fmtB(ir, 1) + fmtB(irpt, 3, 3) + fmtB(iserial, 11, 11) +
      fmtB(igrid6, 25, 25) + fmtB(st.i3, 3, 3);
  }

  // subroutine packtext77(c13,c71)
  // packjt77.f90:1437
  // The mp_short_* byte arithmetic (base 256, 9 bytes) is done with BigInt:
  // qa(2:10) = 42*qa(2:10) + j, kept to 72 bits. 42**13 < 2**71, so nothing
  // is ever truncated and the result is the same.
  packtext77(c13in) {
    const w = adjustr(fstr(c13in, 13));
    let qa = 0n;
    for (let i = 1; i <= 13; i++) {
      let j = findex(C42, w[i - 1]) - 1;
      if (j < 0) j = 0;
      qa = BigInt.asUintN(72, qa * 42n + BigInt(j));
    }
    // write(c71,1010) qa(2:10)   1010 format(b7.7,8b8.8)
    let c71 = fmtB(Number((qa >> 64n) & 0xffn), 7, 7);
    for (let k = 7; k >= 0; k--) c71 += fmtB(Number((qa >> BigInt(8 * k)) & 0xffn), 8, 8);
    return c71;
  }

  // subroutine unpacktext77(c71,c13)
  // packjt77.f90:1461
  // c71 must contain only '0'/'1' (unpack77 checks this first).
  unpacktext77(c71) {
    let qa = BigInt('0b' + fstr(c71, 71)); // read(c71,1010) qa(2:10)
    const out = new Array(13);
    for (let i = 13; i >= 1; i--) {
      const ir = Number(qa % 42n); // call mp_short_div(qb,qa(2:10),9,42,ir)
      out[i - 1] = C42[ir];
      qa = qa / 42n;
    }
    return out.join('');
  }

  // subroutine add_call_to_recent_calls(callsign)
  // packjt77.f90:1529
  addCallToRecentCalls(callsignIn) {
    const callsign = fstr(callsignIn, 13);
    // ! only add if the callsign is not already on the list
    let ladd = true;
    for (let i = 1; i <= MAXRECENT - 1; i++) {
      // ! if callsign is at the end of the list add it again
      if (feq(this.recent_calls[i], callsign)) ladd = false;
    }

    if (ladd) {
      for (let i = MAXRECENT; i >= 2; i--) {
        this.recent_calls[i] = this.recent_calls[i - 1];
      }
      this.recent_calls[1] = callsign;
    }

    // ! Make sure that callsign is hashed
    // !  call save_hash_call(callsign,n10,n12,n22) ! commented out - do this in the calling routine:
  }

  // subroutine to_grid4(n,grid4,ok)
  // packjt77.f90:1553
  // Returns { ok, grid4 }; grid4 is undefined when ok is false (the Fortran
  // leaves the caller's grid4 unchanged). The Fortran also modifies n, but
  // no caller uses it afterwards.
  toGrid4(n) {
    const j1 = Math.trunc(n / (18 * 10 * 10));
    if (j1 < 0 || j1 > 17) return { ok: false };
    n = n - j1 * 18 * 10 * 10;
    const j2 = Math.trunc(n / (10 * 10));
    if (j2 < 0 || j2 > 17) return { ok: false };
    n = n - j2 * 10 * 10;
    const j3 = Math.trunc(n / 10);
    if (j3 < 0 || j3 > 9) return { ok: false };
    const j4 = n - j3 * 10;
    if (j4 < 0 || j4 > 9) return { ok: false };
    const grid4 = char(j1 + ichar('A')) + char(j2 + ichar('A')) + char(j3 + ichar('0')) + char(j4 + ichar('0'));
    return { ok: true, grid4 };
  }

  // subroutine to_grid6(n,grid6,ok)
  // packjt77.f90:1577
  toGrid6(n) {
    const j1 = Math.trunc(n / (18 * 10 * 10 * 24 * 24));
    if (j1 < 0 || j1 > 17) return { ok: false };
    n = n - j1 * 18 * 10 * 10 * 24 * 24;
    const j2 = Math.trunc(n / (10 * 10 * 24 * 24));
    if (j2 < 0 || j2 > 17) return { ok: false };
    n = n - j2 * 10 * 10 * 24 * 24;
    const j3 = Math.trunc(n / (10 * 24 * 24));
    if (j3 < 0 || j3 > 9) return { ok: false };
    n = n - j3 * 10 * 24 * 24;
    const j4 = Math.trunc(n / (24 * 24));
    if (j4 < 0 || j4 > 9) return { ok: false };
    n = n - j4 * 24 * 24;
    const j5 = Math.trunc(n / 24);
    if (j5 < 0 || j5 > 23) return { ok: false };
    const j6 = n - j5 * 24;
    if (j6 < 0 || j6 > 23) return { ok: false };
    const grid6 =
      char(j1 + ichar('A')) + char(j2 + ichar('A')) + char(j3 + ichar('0')) +
      char(j4 + ichar('0')) + char(j5 + ichar('A')) + char(j6 + ichar('A'));
    return { ok: true, grid6 };
  }

  // subroutine to_grid(n,grid6,ok)
  // packjt77.f90:1609
  // ! 4-, or 6-character grid
  toGrid(n) {
    const j1 = Math.trunc(n / (18 * 10 * 10 * 25 * 25));
    if (j1 < 0 || j1 > 17) return { ok: false };
    n = n - j1 * 18 * 10 * 10 * 25 * 25;
    const j2 = Math.trunc(n / (10 * 10 * 25 * 25));
    if (j2 < 0 || j2 > 17) return { ok: false };
    n = n - j2 * 10 * 10 * 25 * 25;
    const j3 = Math.trunc(n / (10 * 25 * 25));
    if (j3 < 0 || j3 > 9) return { ok: false };
    n = n - j3 * 10 * 25 * 25;
    const j4 = Math.trunc(n / (25 * 25));
    if (j4 < 0 || j4 > 9) return { ok: false };
    n = n - j4 * 25 * 25;
    const j5 = Math.trunc(n / 25);
    if (j5 < 0 || j5 > 24) return { ok: false };
    const j6 = n - j5 * 25;
    if (j6 < 0 || j6 > 24) return { ok: false };
    let grid6 = '      '; // grid6=''
    grid6 = setSub(grid6, 1, 1, char(j1 + ichar('A')));
    grid6 = setSub(grid6, 2, 2, char(j2 + ichar('A')));
    grid6 = setSub(grid6, 3, 3, char(j3 + ichar('0')));
    grid6 = setSub(grid6, 4, 4, char(j4 + ichar('0')));
    if (j5 !== 24 || j6 !== 24) {
      grid6 = setSub(grid6, 5, 5, char(j5 + ichar('A')));
      grid6 = setSub(grid6, 6, 6, char(j6 + ichar('A')));
    }
    return { ok: true, grid6 };
  }
}

// genft8.f90:1, text part only:
//   i3=-1; n3=-1; call pack77(msg,i3,n3,c77); call unpack77(c77,0,msgsent,ok)
//   read(c77,'(77i1)',err=1) msgbits; if(ok) go to 2
//   1 msgbits=0; msgsent='*** bad message ***'
// Returns { c77, i3, n3, msgsent, success }. When unpack77 fails, c77 is the
// all-zero msgbits and msgsent is '*** bad message ***'. (The '(77i1)' read
// can only fail when unpack77 has already failed: a successful unpack77
// implies c77 is all '0'/'1'.)
export function genft8Message(state, msg) {
  const p = state.pack77(msg, -1, -1);
  const packUB = state.lastUB;
  const u = state.unpack77(p.c77, 0);
  state.lastUB = packUB.concat(state.lastUB);
  if (u.success) {
    return { c77: p.c77, i3: p.i3, n3: p.n3, msgsent: u.msg, success: true };
  }
  // genft8.f90:1 (label 1)
  return { c77: '0'.repeat(77), i3: p.i3, n3: p.n3, msgsent: '*** bad message ***', success: false };
}

// Fortran helper functions, exported for unit tests of this port only.
export const _fortran = {
  fstr, feq, trimF, lenTrim, adjustl, adjustr, findex, sub, setSub,
  fmtB, fmtI, fmtZ, readZField, listReadInt, nint,
  LR_OK, LR_NULL, LR_ERR, LR_EOF,
};
