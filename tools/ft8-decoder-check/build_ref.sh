#!/usr/bin/env bash
# Builds decode_ref: ft8_lib's demo/decode_ft8.c, natively, with one extra line per decode
# that check.mjs reads (score, time, frequency, candidate position, payload hex, text).
# Usage: ./build_ref.sh <path to ft8_lib checkout>    Output: tools/ft8-decoder-check/build/decode_ref
set -euo pipefail
FT8LIB=$(realpath "${1:?path to ft8_lib checkout}")
cd "$(dirname "$0")"
mkdir -p build
cp "$FT8LIB/demo/decode_ft8.c" build/decode_ref.c
python3 - build/decode_ref.c <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
old = '''            printf("%02d%02d%02d %+05.1f %+4.2f %4.0f ~  %s\\n",
                tm_slot_start->tm_hour, tm_slot_start->tm_min, tm_slot_start->tm_sec,
                snr, time_sec, freq_hz, text);'''
new = '''            printf("%d %.4f %.4f %d %d %d ", cand->score, time_sec, freq_hz, cand->time_offset, cand->freq_offset, cand->time_sub * 10 + cand->freq_sub);
            for (int b = 0; b < 10; b++) printf("%02x", message.payload[b]);
            printf(" %s\\n", text);'''
assert old in s, "decode_ft8.c changed; update build_ref.sh"
s = s.replace(old, new, 1).replace('fprintf(stderr, "#");', '')
open(p, 'w').write(s)
PY
podman run --rm -v "$FT8LIB":/src:Z,ro -v "$PWD/build":/out:Z docker.io/library/gcc:14 sh -c \
  'cd /src && gcc -O3 -DHAVE_STPCPY -I. -o /out/decode_ref /out/decode_ref.c ft8/*.c common/*.c fft/kiss_fft.c fft/kiss_fftr.c -lm -static'
echo "built $(pwd)/build/decode_ref"
