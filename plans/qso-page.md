# Plan: two-way FT8 page (TX and RX)

Status: steps 1 to 5 below are built at `docs/qso/` (live at /qso/), tested here with simulated inputs only. Written 2026-10-13, updated 2026-10-14.

Built so far:
- Receive: ft8_lib's decoder in wasm (`docs/ft8_rx.js`, checked against native ft8_lib on 69 recordings), slot clock with DT-based correction, inputs from a sound card, an RTL-SDR (WebUSB, `docs/vendor/webrtlsdr`), test signals, or an audio file; zoomable waterfall with decode labels; band activity.
- Transmit: `gen_ft8wave` port, transmitter scheduled on the AudioContext clock, WSJT-X-style sequencer (Tx1 to Tx6), controller that books messages per slot, transmit panel and log; Enable transmit per session, Halt TX (button, banner, Escape).
- Radio control: Web Serial with Kenwood TS-480 CAT (QMX, (tr)uSDX) or RTS/DTR PTT.
- Test doubles: `?fake-rtlsdr` (simulated stick), `?fake-radio` (simulated QMX), and test signals with a simulated station (WA9XYZ) that completes QSOs.
- Node tests: `node --test "tools/qso-tests/*.test.mjs"` (slot clock, waveform, IQ to audio, sequencer, CAT).

Known limits:
- Untested with real hardware: sound card input and output, RTL-SDR, CAT and PTT. Nothing has been transmitted on air.
- Firefox will probably refuse the sound card input: the page asks for a 12 kHz AudioContext, and Firefox doesn't resample a microphone to a different rate (Chromium does). Fix: open the context at the device rate and decimate to 12 kHz in JS. Firefox and Safari have no WebUSB or Web Serial, so no RTL-SDR or radio control there.
- No way to set the clock offset by hand yet (the clock line can say "set manually", but nothing sets it).
- The SNR scale matches synthetic signals; comparing with current WSJT-X on the same recording is still to do.
- The log is lost when the page closes (no IndexedDB or ADIF export yet).
- (tr)uSDX audio over its serial port, HackRF, and the WebUSB CH340 driver for Android are not started.
- QMX: CAT command `TA` can set the transmitted tone directly in Digi mode. Sending FT8 that way would need no audio connection at all, which suits phones; worth trying.

First real tests, in order (bench safety: transmit into a dummy load, never directly into an SDR input):
1. RTL-SDR on 20 m or 40 m with a wire antenna: decodes should appear within two slots.
2. QMX as the receive sound card: same, and compare decodes with WSJT-X.
3. QMX transmit into a dummy load, with the second QMX (or the RTL-SDR, heavily attenuated) receiving: the page should decode its own signal at DT near 0.
4. A real QSO.

Goal: a second page, `docs/qso/index.html` (served at `/qso/`), that can hold a complete FT8 QSO in the browser.
Stage 1 uses audio only: a sound card or an SDR for receive, a sound card for transmit, manual PTT or VOX.
Stage 2 adds radio control (PTT, then frequency and mode).

The existing FT8 Player page stays as it is. The new page reuses its modules where they fit.

## Decisions so far

| Question | Decision |
|---|---|
| Page location | `docs/qso/index.html`, modules beside it in `docs/qso/`. |
| Platforms | Chromium desktop browsers and Chrome on Android, both required. Firefox and Safari get the page without radio or SDR control (they have no Web Serial or WebUSB). |
| Long-term Android use | An app version makes more sense; see "Android app" below. The page comes first. |
| Hosting | GitHub Pages for now (ft8play.pengowray.com). See "Hosting" below for when that would change. |
| Test hardware | 2 × QRP Labs QMX, (tr)uSDX, HackRF (PortaPack Mayhem H4M), RTL-SDR V3, RTL-SDR V4. See "Test hardware". |

## What already exists

| Need | Existing piece | Notes |
|---|---|---|
| Text to 77 bits and back | `docs/wsjtx/packjt77.js` | Port of WSJT-X 2.7.0 `packjt77.f90`, checked against gfortran. Has the hash tables and `mycall13`/`dxcall13` handling that a receiver needs (`unpack77(c77, nrx=1)`). |
| Message model | `docs/ft8_msg.js`, `docs/ft8_engines.js` | `FT8Message` has no DOM or audio code, so the QSO page can use it directly. |
| 77 bits to 79 tones | ft8_lib wasm (`packedDataToSymbols`), `ft8_checks.js` (CRC, LDPC), `ft8_constants.js` (Gray map) | Same in every implementation. |
| Tones to audio | ft8_lib wasm `synth_gfsk_custom`, used by `docs/ft8_audio.js` | GFSK, BT 2.0. Port WSJT-X `gen_ft8wave.f90` too, so the TX waveform matches WSJT-X sample for sample (ramp shape, dummy first and last symbols). |
| Play at the next slot | `MessageAudio.queueAudio()` | Uses the device clock and `getSeconds()`; needs replacing with a slot clock (below). |
| Clock check | `docs/timekeep.js` (untracked work in progress) | HTTP `Date` headers only give 1 second resolution. |
| Decoder | none in the page | ft8_lib has one in C (`ft8/decode.c`, `demo/decode_ft8.c`). MSHV has a C++ port of the WSJT-X decoder (`src/HvDecoderMs/decoderft8.cpp`, 2,670 lines) with bundled FFTW. |
| SDR over WebUSB | none | References: [webrtlsdr](https://github.com/jtarrio/webrtlsdr) by Jacobo Tarrio, the library behind [Radio Receiver](https://radio.ea1iti.es/) (TypeScript, Apache-2.0; RTL-SDR V3 direct sampling and V4 upconverter, desktop and Android Chrome), [hackrf.js](https://github.com/mildsunrise/hackrf.js) (MIT; HackRF RX and TX over WebUSB), BrowSDR (Rust/wasm DSP in workers, HackRF and RTL-SDR V4). |
| DSP and spectrogram code | Oversample (`~/projects/batchi`) | See "Overlap with Oversample". |
| Rig control | none | Kenwood TS-480 CAT covers all the test transceivers; Hamlib (LGPL) later for other radios. See section 9. |

## Receive sources and transmit sinks

The FT8 code works on 12 kHz real audio with sample-accurate UTC timestamps. Everything that receives or transmits sits behind two small interfaces, so the decoder and sequencer don't care where audio comes from:

- `RxSource`: emits 12 kHz Float32 chunks, each with the UTC time of its first sample. Implementations:
  - sound card (`getUserMedia`): any radio's audio output, or the QMX's USB sound card;
  - RTL-SDR over WebUSB: IQ samples, tuned to the dial frequency, mixed and filtered to the 0 to 3 kHz USB passband, decimated to 12 kHz;
  - HackRF over WebUSB: the same, from 8-bit IQ;
  - (tr)uSDX audio over its serial port (about 7,825 Hz, resampled to 12 kHz).
- `TxSink`: takes the 79 tones (or samples) and a start time. Implementations:
  - sound card (`setSinkId` to pick the radio's USB sound card);
  - HackRF over WebUSB: FT8 generated directly as complex IQ at the RF offset, with no audio stage;
  - (tr)uSDX audio over its serial port (about 11,520 Hz).

Accurate timestamps matter: DT (time offset) is measured from them, and the slot clock uses DT to correct the device clock.

## Stage 1: audio only

### 1. Slot clock (`qso/slot_clock.js`)
- One source of truth for "time now", "current slot", "seconds into slot", "even or odd slot". Slot length comes from the mode settings (15 s for FT8), not a constant.
- Clock offset = device clock correction in ms. Sources, in order of preference:
  1. Median DT of recent decodes. Every decoded signal reports its time offset (DT); if the median DT of strong decodes drifts from 0, the device clock is off by that much. This is how JTSync works and needs no network.
  2. HTTP `Date` header round trips (timekeep.js) as a coarse first guess at page load.
  3. Manual offset in settings.
- Show the current offset and its source on the page.

### 2. Sound card input (`qso/sources/audio_in.js`)
- `getUserMedia` with `echoCancellation`, `noiseSuppression` and `autoGainControl` all set to `false`. Without this, browsers filter out FT8 signals.
- Input device picker (`enumerateDevices`), so a USB sound card or the radio's built-in codec can be chosen. On Android, check whether Chrome lists the QMX's USB sound card as its own input or just routes it as the default microphone.
- AudioWorklet passes samples to the page with `postMessage` (no SharedArrayBuffer needed; see "Hosting").
- Resample from the context rate (usually 48 kHz) to 12 kHz, the WSJT-X decoder rate: low-pass FIR, then decimate by 4.
- Input level meter and a waterfall (canvas, scrolling spectrogram, 0 to 3,000 Hz).

### 3. SDR input (`qso/sources/rtlsdr.js`, `hackrf.js`, DSP in `qso/dsp/`)
- WebUSB works in Chromium on desktop and on Android, which makes the RTL-SDR the easiest way to receive real FT8 on a phone.
- RTL-SDR V4: HF through its built-in upconverter (up to about 28.8 MHz). RTL-SDR V3: HF through direct sampling (Q branch). Use or follow webrtlsdr for both (Apache-2.0, compatible with this project with attribution).
- DSP chain: complex mix so the dial frequency sits at 0 Hz, low-pass at about 3 kHz, decimate to 12 kHz, take the real part (upper sideband). Run it in a worker; write it in JS first, and move it to wasm only if it's too slow on a phone.
- The waterfall uses the same 12 kHz audio as for the sound card, so it looks the same whatever the source.

### 4. Decoder (`qso/decoder_worker.js`, Web Worker)
- At about 13.5 s into each slot, hand the worker the slot's 12 kHz samples (15 s = 180,000 samples).
- First decoder: ft8_lib's, compiled to wasm in the existing fork (add an export that takes float samples and returns candidates with SNR, DT, frequency and the 77 bits). It is small and already builds with emscripten.
- Unpack in the main thread with a PackJT77 instance that lives for the whole session, `nrx=1`, with `mycall13` and `dxcall13` set, so hashed calls resolve the same way WSJT-X resolves them.
- Later: a more sensitive decoder. Options, best first:
  1. MSHV `decoderft8.cpp` compiled with emscripten (C++, same algorithm as WSJT-X including a-priori decoding and signal subtraction). Needs its FFTW build and some Qt types replaced, as was done for pack/unpack.
  2. WSJT-X's own Fortran decoder via flang-wasm (r-wasm toolchain). Exact, but heavy, and needs FFTW in wasm.
- Test with recorded WAVs: `../rr73-bug/wsjt-x wavs/` has WSJT-X recordings; also loop the page's own TX audio straight into the decoder, and record off-air slots from the RTL-SDR as test files.

### 5. Band activity and QSO panel (UI)
- Left: decodes for the current and previous slots, one row per decode: UTC, SNR dB, DT s, frequency Hz, message text. Highlight lines that contain my call, CQs, and the station in QSO.
- Right: the six standard messages (WSJT-X Tx1 to Tx6) generated from my call, my grid, DX call, DX grid and reports, each editable, with a "Next" pick.
- Settings: my call, my grid, TX frequency (Hz offset), RX frequency, TX on even or odd slots, receive source, transmit sink, TX level.
- Double-click (or tap) a decode to answer it: sets DX call, picks the TX slot opposite to theirs, and selects the right next message.
- Phone layout: band activity and the QSO panel as two views, switched with tabs, rather than squeezed side by side.

### 6. Sequencer (`qso/sequencer.js`)
- State machine with the WSJT-X auto-sequence rules: CQ, grid reply, report, R+report, RRR or RR73, 73.
- Inputs: decodes addressed to my call from the DX call; outputs: the next message to send.
- Stops transmitting after a set number of unanswered repeats (WSJT-X default: watchdog after N minutes). "Halt TX" always available and keyboard-accessible.
- Pure module with no DOM, so it can be unit tested with scripted decodes.

### 7. Transmit (`qso/tx.js`, `qso/sinks/`)
- Build the message with PackJT77 (`pack77`, then `unpack77(nrx=0)` to show the text actually sent, as `genft8` does).
- Generate audio at 48 kHz (or the sink's rate) using the port of `gen_ft8wave.f90`.
- Start 0.5 s after the slot boundary (FT8 signals start at DT = 0, which is 0.5 s into the slot), scheduled with `AudioContext` time rather than `setTimeout`.
- PTT in stage 1: VOX on the radio, or the operator keys manually. Show a clear "Transmitting" state.
- Require a callsign and an explicit "Enable TX" each session; transmitting needs an amateur licence.

### 8. Logging
- Log completed QSOs to ADIF (download), stored in IndexedDB until exported.
- Later, with a server: sync logs and recordings between devices, upload to QRZ, LoTW, Club Log, and send PSK Reporter spots (see "Hosting").

## Stage 2: radio control

### Web Serial availability
- Chromium desktop: yes.
- Chrome on Android: Web Serial arrived in Chrome 148 (2026). Wired serial ports only show up on phones whose Android version exposes them, and devices using vendor USB-serial chips (CH340, FTDI, CP210x) have been reported as still needing WebUSB there. Standard USB CDC-ACM devices are the most likely to work.
- Fallback on Android: WebUSB, with Google's web-serial-polyfill for CDC-ACM and small drivers for CH340/CP210x/FTDI if needed. The Android app (below) avoids the problem with a native USB serial library.
- Firefox and Safari: no Web Serial or WebUSB. Option B in section 10 (rigctld) is the only route there.

### 9. PTT
- CAT PTT (`TX;` / `RX;`) for both test transceivers.
- RTS or DTR line via `port.setSignals({ requestToSend: true })`, for interfaces like Digirig and SignaLink-style boxes.

### 10. CAT (`qso/radio/*.js`)
Same interface whichever option is used: `connect`, `setPtt(on)`, `getFrequency`, `setFrequency(hz)`, `setMode('DATA-USB')`.

**First: a hand-written Kenwood TS-480 module.** Both test transceivers use a subset of Kenwood TS-480 CAT (`FA00014074000;`, `TX;`, `RX;`, `MD...;`), so one small module covers all of them:
- QMX: one USB cable gives a 24-bit 48 kHz USB sound card and up to three virtual COM ports. CAT commands end in `;` with no CR or LF; sending a CR switches that port to terminal mode, so never send one. QRP Labs adds its own commands on top of the TS-480 set (see the QMX CAT manual).
- (tr)uSDX: TS-480 CAT emulation, plus receive and transmit audio streamed over the same serial port (the `UA` commands; about 7,825 Hz receive and 11,520 Hz transmit, according to the [truSDX-Linux](https://github.com/miltonics/truSDX-Linux) driver). Read that driver's source for the exact byte format before writing the module. This makes the whole radio work over one serial connection, with no sound card.

**Later: Hamlib, for other people's radios.**
- Option A, Hamlib compiled to wasm. [Hamlib](https://hamlib.github.io/) is the rig control library used by WSJT-X, JTDX, fldigi and most other ham software. It supports 300+ radios and handles each radio's quirks. The library is LGPL-2.1, compatible with this project's GPLv3 parts; linking it statically into wasm is fine as long as the source and build scripts are published. Hamlib's serial I/O is synchronous (file descriptors, termios, `select()` timeouts) and Web Serial is promise-based, so the bridge is a small Hamlib port backend whose read and write call JavaScript, made synchronous with Emscripten Asyncify or JSPI. Run it in a worker. I don't know of a maintained wasm build, so start with a spike: `rig_open`, `rig_set_freq`, `rig_get_freq`, `rig_set_ptt` for one radio.
- Option B, Hamlib's `rigctld` on the user's computer, through a WebSocket bridge (for example websockify), since browsers can't open TCP sockets. Works in any browser, but needs installed software.
- Hand-written Yaesu (`FA014074000;`, `TX1;`, `TX0;`) and Icom CI-V (`FE FE <addr> E0 <cmd> ... FD`; PTT is `1C 00`) modules only if Hamlib doesn't work out.

For all options:
- Band and frequency picker with the standard FT8 dial frequencies.
- Poll frequency every second while idle; don't poll during TX on radios that drop CAT during TX.

## Test hardware

| Device | Receive | Transmit | Connection | Use in testing |
|---|---|---|---|---|
| RTL-SDR V4 | HF via upconverter, up to about 28.8 MHz | no | WebUSB | First off-air decodes: needs only a receive antenna (a wire), no licence or TX antenna. Desktop and Android. |
| RTL-SDR V3 | HF via direct sampling | no | WebUSB | Same, and to compare with the V4. |
| QMX (×2) | yes | yes, about 5 W | USB: sound card + CAT serial | Two QMXs into dummy loads give a full bench QSO without an antenna; then on-air. |
| (tr)uSDX | yes | yes | USB serial: CAT + audio | The serial-audio source and sink. |
| HackRF (PortaPack Mayhem H4M, in HackRF mode) | yes | yes, low power at HF | WebUSB | IQ source and sink; bench TX into the RTL-SDR. Its output needs a low-pass filter before going near an antenna (harmonics). |

Bench safety: never connect a transmitter directly to an RTL-SDR or HackRF input. Use a dummy load and heavy attenuation (40 to 60 dB for 5 W); a direct 5 W connection destroys the receiver.

Before testing (user): update the QMX and (tr)uSDX firmware, set up an antenna for TX, and check that the H4M's HackRF mode works over WebUSB.

## Hosting

- Now: GitHub Pages. Design the page so it doesn't need SharedArrayBuffer: audio moves from the worklet and workers with `postMessage` (15 s of 12 kHz Float32 is 720 KB per slot, which is cheap).
- If SharedArrayBuffer or wasm threads become necessary (for example a heavier multi-threaded decoder): [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) works on GitHub Pages. Caveats: the page reloads once on the first visit, and every cross-origin resource must allow embedding, or the page uses COEP `credentialless` (supported by coi-serviceworker in Chromium). The QSO page should load no third-party resources anyway.
- Cloudflare Pages sets COOP/COEP headers with a `_headers` file, on the free plan, if the service worker becomes a problem.
- Later server, for accounts, saved logs and recordings, and bridges to logging sites:
  - Cloudflare Workers + D1 (SQL) + R2 (files): little to maintain, free tier, fits accounts, logs, recordings and HTTP-based uploads (QRZ, LoTW, Club Log).
  - A small VPS (Oracle Cloud free tier, DigitalOcean) for anything that needs long-running processes or UDP, such as PSK Reporter spots (sent over UDP) or WebSocket bridges.
  - These can be combined: static page and API on Cloudflare, a VPS only for the UDP relay.

## Android app (long term)

- A Tauri 2 Android app around the same page, as Oversample does. Native code fixes the browser's Android gaps: USB serial for every chip (usb-serial-for-android), direct USB audio, running with the screen off, and no permission prompts each session.
- Oversample already has the pieces to copy: the Tauri 2 Android project, `UsbAudioPlugin.kt` and the Rust USB audio streaming in `src-tauri/src/usb_audio.rs`, and cpal audio.
- The page should keep its radio and audio access behind the `RxSource`/`TxSink`/CAT interfaces, so the app can swap in native implementations.

## Overlap with Oversample (`~/projects/batchi`)

- Useful:
  - `oversample-core` (Rust, MIT OR Apache-2.0): STFT with realfft, filters, heterodyne mixing, AGC, PSD, spectrogram tile store and colour maps. Candidates for the waterfall and the SDR DSP chain, built with wasm-bindgen into a small module and shipped prebuilt, like the ft8_lib and MSHV modules.
  - The Tauri Android shell and USB audio plugin, for the app version.
  - The recording and crash-recovery code, for saving off-air recordings.
- Not useful: the Leptos UI (this project is plain JS) and the bat-specific analysis.
- Option for later: move the shared DSP into a small crate that both projects use.

## Later: JS8Call

- JS8 uses FT8's modulation and coding (8-tone GFSK, 79 symbols, LDPC (174,91)) with different sync arrays, its own message framing, and four speeds: Slow (30 s slots, 25 Hz wide), Normal (15 s, 50 Hz), Fast (10 s, 80 Hz) and Turbo (6 s, 160 Hz). Check the JS8Call source for the sync arrays and framing.
- What this means now: keep mode parameters as data (slot length, symbol period, tone spacing, sync pattern) in the slot clock, decoder interface, TX generator and waterfall, rather than FT8 constants. Keep the FT8 QSO sequencer separate from the modem, since JS8 is message-based (heartbeats, directed messages, relays).
- JS8Call is GPLv3, derived from WSJT-X; JS8Call-improved is the active fork.

## Suggested module layout

```
docs/qso/index.html
docs/qso/slot_clock.js
docs/qso/modes.js                 (FT8 parameters now; JS8 later)
docs/qso/sources/audio_in.js      (+ audio_in_worklet.js)
docs/qso/sources/rtlsdr.js
docs/qso/sources/hackrf.js
docs/qso/dsp/                     (IQ mixing, filters, decimation, resampling)
docs/qso/decoder_worker.js        (+ ft8 decoder wasm)
docs/qso/sequencer.js
docs/qso/tx.js                    (+ gen_ft8wave port)
docs/qso/sinks/audio_out.js, hackrf_tx.js
docs/qso/log_adif.js
docs/qso/radio/serial.js          (Web Serial / WebUSB fallback, RTS/DTR PTT)
docs/qso/radio/kenwood.js         (QMX, (tr)uSDX)
docs/qso/radio/trusdx_audio.js    (serial audio source and sink)
docs/qso/radio/hamlib/            (later)
docs/qso/radio/rigctld.js         (later)
```

## Order of work

1. ~~Slot clock, sound card input and waterfall.~~ Done; check levels with a QMX.
2. ~~ft8_lib decoder in a worker; decode recorded WAVs.~~ Done.
3. ~~RTL-SDR source.~~ Done with a simulated stick; untested with a real one. Next: decode real FT8 off-air with a wire antenna, on desktop and on an Android phone.
4. ~~TX: port `gen_ft8wave`, sound card sink, Kenwood CAT PTT.~~ Done; untested with a radio. Next: bench QSO between the two QMXs into dummy loads.
5. ~~Sequencer with unit tests.~~ Done (simulated QSOs complete). Next: full bench QSO, then on-air once the antenna is up.
6. (tr)uSDX: Kenwood CAT plus serial audio.
7. HackRF source and sink (bench only).
8. Better decoder (MSHV port).
9. Hamlib wasm spike, and the rigctld bridge, for other radios.
10. Android app (Tauri) once the page works.

## Open questions

- Does Chrome on your Android phone list the QMX's sound card as an input, and its serial ports in Web Serial? (Needs Chrome 148 or later, and depends on the phone's Android version.) To check.
- (tr)uSDX USB-serial chip: CH340 (or CH341). On desktop Chromium, Web Serial works through the OS driver. On Android it will probably need a WebUSB CH340 driver in the page (the CH34x protocol is small: a few vendor control requests for baud rate and line control, then bulk transfers), or the Android app.
- H4M in HackRF mode over WebUSB: probably works, since its firmware can be updated from a Chrome web page. Not yet tested on Android.
