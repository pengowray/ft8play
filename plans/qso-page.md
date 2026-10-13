# Plan: two-way FT8 page (TX and RX)

Status: plan only, nothing built yet. Written 2026-10-13.

Goal: a second page, `docs/qso.html`, that can hold a complete FT8 QSO in the browser.
Stage 1 uses the computer's sound card only (audio in, audio out, manual PTT or VOX).
Stage 2 adds radio control over Web Serial: PTT, then frequency and mode.

The existing FT8 Player page stays as it is. The new page reuses its modules where they fit.

## What already exists

| Need | Existing piece | Notes |
|---|---|---|
| Text to 77 bits and back | `docs/wsjtx/packjt77.js` | Port of WSJT-X 2.7.0 `packjt77.f90`, checked against gfortran. Has the hash tables and `mycall13`/`dxcall13` handling that a receiver needs (`unpack77(c77, nrx=1)`). |
| 77 bits to 79 tones | ft8_lib wasm (`packedDataToSymbols`), `ft8_extra.js` (CRC, LDPC, Gray map) | Same in every implementation. |
| Tones to audio | ft8_lib wasm `synth_gfsk_custom` | GFSK, BT 2.0. Port WSJT-X `gen_ft8wave.f90` too, so the TX waveform matches WSJT-X sample for sample (ramp shape, dummy first and last symbols). |
| Play at the next slot | `FT8Message.queueAudio()` | Uses the device clock and `getSeconds()`; needs replacing with a slot clock (below). |
| Clock check | `docs/timekeep.js` (untracked work in progress) | HTTP `Date` headers only give 1 second resolution. |
| Decoder | none in the page | ft8_lib has one in C (`ft8/decode.c`, `demo/decode_ft8.c`). MSHV has a C++ port of the WSJT-X decoder (`src/HvDecoderMs/decoderft8.cpp`, 2,670 lines) with bundled FFTW. |
| Rig control | none | Hamlib (LGPL) is the standard library for this; see section 9. MSHV `src/HvRigControl/` also has CAT command tables for many radios (GPL, C++). |

## Stage 1: audio only

### 1. Slot clock (`qso/slot_clock.js`)
- One source of truth for "time now", "current 15 s slot", "seconds into slot", "even or odd slot".
- Clock offset = device clock correction in ms. Sources, in order of preference:
  1. Median DT of recent decodes. Every decoded signal reports its time offset (DT); if the median DT of strong decodes drifts from 0, the device clock is off by that much. This is how JTSync works and needs no network.
  2. HTTP `Date` header round trips (timekeep.js) as a coarse first guess at page load.
  3. Manual offset in settings.
- Show the current offset and its source on the page.

### 2. Audio input (`qso/audio_in.js`)
- `getUserMedia` with `echoCancellation`, `noiseSuppression` and `autoGainControl` all set to `false`. Without this, browsers filter out FT8 signals.
- Input device picker (`enumerateDevices`), so a USB sound card or the radio's built-in codec can be chosen.
- AudioWorklet copies samples into a ring buffer (SharedArrayBuffer if the page is cross-origin isolated, else `postMessage` of chunks).
- Resample from the context rate (usually 48 kHz) to 12 kHz, the WSJT-X decoder rate: low-pass FIR, then decimate by 4.
- Input level meter and a waterfall (canvas, scrolling spectrogram, 0 to 3,000 Hz).

### 3. Decoder (`qso/decoder_worker.js`, Web Worker)
- At about 13.5 s into each slot, hand the worker the slot's 12 kHz samples (15 s = 180,000 samples).
- First decoder: ft8_lib's, compiled to wasm in the existing fork (add an export that takes float samples and returns candidates with SNR, DT, frequency and the 77 bits). It is small and already builds with emscripten.
- Unpack in the main thread with a PackJT77 instance that lives for the whole session, `nrx=1`, with `mycall13` and `dxcall13` set, so hashed calls resolve the same way WSJT-X resolves them.
- Later: a more sensitive decoder. Options, best first:
  1. MSHV `decoderft8.cpp` compiled with emscripten (C++, same algorithm as WSJT-X including a-priori decoding and signal subtraction). Needs its FFTW build and some Qt types replaced, as was done for pack/unpack.
  2. WSJT-X's own Fortran decoder via flang-wasm (r-wasm toolchain). Exact, but heavy, and needs FFTW in wasm.
- Test with recorded WAVs: `../rr73-bug/wsjt-x wavs/` has WSJT-X recordings; also loop the page's own TX audio straight into the decoder.

### 4. Band activity and QSO panel (UI)
- Left: decodes for the current and previous slots, one row per decode: UTC, SNR dB, DT s, frequency Hz, message text. Highlight lines that contain my call, CQs, and the station in QSO.
- Right: the six standard messages (WSJT-X Tx1 to Tx6) generated from my call, my grid, DX call, DX grid and reports, each editable, with a "Next" pick.
- Settings: my call, my grid, TX frequency (Hz offset), RX frequency, TX on even or odd slots, audio devices, TX level.
- Double-click a decode to answer it: sets DX call, picks the TX slot opposite to theirs, and selects the right next message.

### 5. Sequencer (`qso/sequencer.js`)
- State machine with the WSJT-X auto-sequence rules: CQ, grid reply, report, R+report, RRR or RR73, 73.
- Inputs: decodes addressed to my call from the DX call; outputs: the next message to send.
- Stops transmitting after a set number of unanswered repeats (WSJT-X default: watchdog after N minutes). "Halt TX" always available and keyboard-accessible.
- Pure module with no DOM, so it can be unit tested with scripted decodes.

### 6. Transmit (`qso/tx.js`)
- Build the message with PackJT77 (`pack77`, then `unpack77(nrx=0)` to show the text actually sent, as `genft8` does).
- Generate audio at 48 kHz (or the output context rate) using the port of `gen_ft8wave.f90`.
- Start audio 0.5 s after the slot boundary (FT8 signals start at DT = 0, which is 0.5 s into the slot), scheduled with `AudioContext` time rather than `setTimeout`.
- Output device picker (`setSinkId`, Chromium only).
- PTT in stage 1: VOX on the radio, or the operator keys manually. Show a clear "Transmitting" state.
- Require a callsign and an explicit "Enable TX" each session; transmitting needs an amateur licence.

### 7. Logging
- Log completed QSOs to ADIF (download), stored in IndexedDB until exported.
- Optional later: PSK Reporter spots (needs a server-side relay, since the browser cannot send UDP).

## Stage 2: radio over Web Serial

Web Serial works in Chromium desktop browsers. Firefox and Safari have no Web Serial. Android Chrome support should be checked at build time; WebUSB with a small CDC-ACM/CP210x/FTDI driver is the fallback there.

### 8. PTT
- RTS or DTR line via `port.setSignals({ requestToSend: true })`. Works with Digirig, SignaLink-style interfaces, and most radios' USB serial port.
- CAT PTT (below) for radios with built-in USB codecs.

### 9. CAT (`qso/radio/*.js`)
Same interface whichever option is used: `connect`, `setPtt(on)`, `getFrequency`, `setFrequency(hz)`, `setMode('DATA-USB')`.

**Option A: Hamlib compiled to wasm (preferred if the spike works).** [Hamlib](https://hamlib.github.io/) is the rig control library used by WSJT-X, JTDX, fldigi and most other ham software. It supports 300+ radios and already handles each radio's quirks (CI-V addresses, command timing, radios that drop CAT during TX).
- Licence: the library is LGPL-2.1, which is compatible with this project's GPLv3. Linking it statically into a wasm module is fine as long as the source and build scripts are published, which they would be.
- Work needed: Hamlib does serial I/O with file descriptors, termios and `select()` timeouts, all synchronous. Web Serial is promise-based. The bridge is a small Hamlib port backend (or a patch to `iofunc.c`/`serial.c`) whose read and write call JavaScript, made synchronous from C with Emscripten Asyncify or JSPI (JavaScript Promise Integration, in Chromium since 2025). Configure Hamlib without threads, USB (libusb) and network backends.
- Run it in a Web Worker, so slow serial reads never block the page.
- I don't know of a maintained wasm build of Hamlib, so start with a spike: build `rig_open`, `rig_set_freq`, `rig_get_freq` and `rig_set_ptt` for one radio, and check timing against the real radio.

**Option B: Hamlib's `rigctld` on the user's computer.** Browsers can't open TCP sockets, so this needs a WebSocket bridge (for example websockify) as well as rigctld. It works in any browser, including Firefox and Safari, which have no Web Serial, but needs installed software. Worth supporting later as a fallback, since rigctld's text protocol is simple.

**Option C: hand-written modules for the main protocol families.** Fallback if the Hamlib spike fails, or for a first test before it:
- Kenwood and Elecraft text protocol (`FA00014074000;`, `TX;`, `RX;`).
- Yaesu newer text protocol (FT-991A, FTDX10, FT-710: `FA014074000;`, `TX1;`, `TX0;`).
- Icom CI-V binary frames (`FE FE <radio addr> E0 <cmd> ... FD`; PTT is command `1C 00`).

For all options:
- Band and frequency picker with the standard FT8 dial frequencies.
- Poll frequency every second while idle; don't poll during TX on radios that drop CAT during TX.
- RTS/DTR PTT (section 8) stays hand-written; it is two lines of Web Serial.

## Suggested module layout

```
docs/qso.html
docs/qso/slot_clock.js
docs/qso/audio_in.js        (+ audio_in_worklet.js)
docs/qso/decoder_worker.js  (+ ft8 decoder wasm)
docs/qso/sequencer.js
docs/qso/tx.js              (+ gen_ft8wave port)
docs/qso/log_adif.js
docs/qso/radio/serial.js     (Web Serial, RTS/DTR PTT)
docs/qso/radio/hamlib/       (Hamlib wasm + Web Serial I/O bridge, in a worker)
docs/qso/radio/rigctld.js    (later: rigctld over a WebSocket bridge)
```

## Order of work

1. Slot clock and audio input with a waterfall (no decoding yet). Check levels with a real radio.
2. ft8_lib decoder in a worker; decode recorded WAVs, then live audio.
3. TX of a fixed message at the right slot; loopback test into the decoder.
4. Sequencer with unit tests; full QSO with VOX or manual PTT.
5. RTS/DTR PTT over Web Serial.
6. Hamlib wasm spike for the user's radio (option A). If it works, use Hamlib for all CAT; if not, hand-written modules (option C).
7. Better decoder (MSHV port).

## Open questions for later

- Which radio and interface will be used for testing stage 2?
- Is the page meant to work on Android phones? This decides WebUSB versus Web Serial work.
- Host on GitHub Pages as now? Cross-origin isolation for SharedArrayBuffer needs COOP/COEP headers, which GitHub Pages cannot set; a service worker workaround (coi-serviceworker) exists, or use `postMessage` chunks instead.
