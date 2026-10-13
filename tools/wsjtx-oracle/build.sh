#!/usr/bin/env bash
# Builds the WSJT-X packjt77 reference program with gfortran inside the
# official gcc container. Output: tools/wsjtx-oracle/build/oracle
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
SRC="../packjt_stub.f90 ../wsjtx-2.7.0/packjt77.f90 ../wsjtx-2.7.0/chkcall.f90 ../wsjtx-2.7.0/fmtmsg.f90 ../oracle.f90"
FLAGS="-O2 -fbounds-check -funroll-all-loops -fno-f2c -static"

# Some WSJT-X routines read local variables before setting them (for example
# nserial in pack77_3). Real WSJT-X then gets whatever is in memory.
#   oracle:         uninitialised locals read as 0 (the port does the same)
#   oracle_garbage: uninitialised locals read as junk values; inputs where the
#                   two programs disagree depend on uninitialised memory in WSJT-X.
podman run --rm -v "$PWD":/w:Z -w /w/build docker.io/library/gcc:14 sh -c "
  gfortran $FLAGS -finit-local-zero -o oracle $SRC &&
  gfortran $FLAGS -finit-integer=4097 -finit-logical=true -finit-character=63 -o oracle_garbage $SRC &&
  rm -f *.mod"
echo "built $(pwd)/build/oracle and oracle_garbage"
