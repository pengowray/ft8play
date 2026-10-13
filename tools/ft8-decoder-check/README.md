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
- SNR: `FT8Receiver.snr()` gives the true SNR (within about 1 dB) for synthetic signals in white noise, with SNR defined as in WSJT-X's `ft8sim` (see `tools/qso-tests/ft8_wave.test.mjs`). On these recordings it is a median 6.4 dB higher than the SNRs in the `.txt` files, with half of the decodes within about 3 dB of that. The `.txt` files come from WSJT-X 2.1 (2019); its SNR estimate may differ from current WSJT-X's. Comparing with a recording decoded by current WSJT-X is still to do.
