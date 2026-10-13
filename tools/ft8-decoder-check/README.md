# FT8 audio decoder check

Checks `docs/ft8_rx.js`, which runs ft8_lib's FT8 decoder in wasm (`rxft8_*` functions from the fork's `wasm/src/rxft8.c`).

- **wasm against native:** for every WAV file, the wasm decoder must give the same decodes as ft8_lib's own `decode_ft8` demo compiled natively: same payloads, scores, times and frequencies, in the same order.
- **Against WSJT-X:** where a `.txt` file of WSJT-X decodes sits next to a WAV (ft8_lib's `test/wav` folder has 69 recordings, most with one), it reports the share of WSJT-X's decodes that ft8_lib finds, and how the time offset (DT) and SNR compare with WSJT-X's.

## Run

```bash
./build_ref.sh ../../../ft8_lib          # once: builds build/decode_ref with gcc in the gcc:14 container (podman)
node check.mjs build/decode_ref ../../../ft8_lib/test/wav
```

Exit code 0 when wasm and native agree on every file.

## Results (October 2026, ft8_lib 9fec6ca)

- 69 files, 1,048 decodes: wasm and native identical on every file.
- ft8_lib finds 933 of the 1,298 messages WSJT-X decoded (72%).
- DT: ft8_lib's candidate time is one symbol (0.16 s) after the signal start, so `FT8Receiver.dt()` subtracts 0.16 s plus the 0.5 s nominal start. Median difference from WSJT-X's DT: 0.00 s.
- SNR: `FT8Receiver.snr()` is calibrated to WSJT-X's scale. Median difference 0.0 dB; half of the decodes are within about 3 dB, 90% within about 8 dB. WSJT-X's own SNR is an estimate too, so treat both as approximate.
