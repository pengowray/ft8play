# WSJT-X packjt77 reference check

Checks `docs/wsjtx/packjt77.js` (the JavaScript port of WSJT-X's message packer) against the original Fortran, `packjt77.f90` from WSJT-X 2.7.0, compiled with gfortran.

## Files

- `wsjtx-2.7.0/`: unmodified files from the WSJT-X 2.7.0 source (git tag `wsjtx-2.7.0`, commit b4f9a43, February 2025), GPLv3. `testmsgs/` holds the WSJT-X test message lists.
- `oracle.f90`: a small Fortran program that reads commands on stdin and prints results, one line per command. The command format is described at the top of the file.
- `packjt_stub.f90`: an empty `packjt` module. `pack77` has `use packjt` but uses nothing from it.
- `build.sh`: compiles the program with gfortran in the official `gcc:14` container (podman), using WSJT-X's release Fortran flags. Output: `build/oracle` (static binary, not committed).
- `corpus.mjs`: generates the test sessions: every message in the WSJT-X test lists and `docs/ft8_tests.js`, random messages of every type, random 77-bit strings, and sessions that set My Call / DX Call and build up hash tables before unpacking.
- `compare.mjs`: runs each session through the Fortran program and through the port, and reports the first mismatch in each session.

## Run

```bash
./build.sh
node compare.mjs
```

Options: `--seed=N` (different random messages), `--scale=N` (more sessions), `--examples=N` (mismatches to print), `--only=<session name prefix>`.

Each session runs in a fresh process and a fresh `PackJT77`, because WSJT-X keeps hash tables and some saved variables for the life of the program. Commands within a session share that state, so the check also covers hash table updates.
