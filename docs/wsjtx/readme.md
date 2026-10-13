## About

`packjt77.js` is a line-by-line JavaScript port of the FT8 message packing code from [WSJT-X](https://wsjt.sourceforge.io/wsjtx.html) 2.7.0 by Joe Taylor (K1JT), Steve Franke (K9AN) and the WSJT Development Group: `lib/77bit/packjt77.f90`, plus `chkcall.f90`, `fmtmsg.f90` and the text part of `genft8.f90`. It turns message text into the 77 message bits and back, including WSJT-X's callsign hash tables.

The port keeps WSJT-X's behaviour exactly, including its known quirks. For example, `RR73` is sent as the grid square RR73 rather than as the RR73 code.

`wsjtx_engine.js` connects the port to FT8 Player.

## How it was checked

The port was compared with the original Fortran, compiled with gfortran 14 using WSJT-X's release compiler flags. The comparison covered more than 340,000 commands: every message in the WSJT-X test lists, random messages of every type, random 77-bit strings, and sequences that build up hash tables and set My Call and DX Call. Every output matched: the 77 bits, the message type, the decoded text and the success flag. The test programs are in [`tools/wsjtx-oracle`](https://github.com/pengowray/ft8play/tree/main/tools/wsjtx-oracle).

In some invalid messages, WSJT-X reads variables that were never set, so its output depends on leftover memory. The port uses 0 for those variables, which matches gfortran with `-finit-local-zero`.

## Source Code and License

WSJT-X source: https://sourceforge.net/projects/wsjt/ (git tag `wsjtx-2.7.0`).

WSJT-X is licensed under the GNU General Public License version 3. This port is a derivative work and is also licensed under the GPLv3.
