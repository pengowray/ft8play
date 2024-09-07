## About 

This is a web assembly port of [MSHV Amateur Radio Software](http://lz2hv.org/mshv) by LZ2HV ([sourceforge link](https://sourceforge.net/projects/mshv/)). 

MSHV is multiplatform software designed for use by amateur radio afficinados. It supports many radio modes: MSK JTMS FSK ISCAT JT6M FT8/4 JT65 PI4 Q65. It builds on the open source work of Joe Taylor (K1JT), Steve Franke (K9AN) and many others, which is available in the open source WSJT-X software.

MSHV is written in C++ and uses the Qt framework. This port is a subset of the original software, focusing on the FT8 mode. It is compiled to web assembly using emscripten. MSHV's FT8 pack/unpack functions are exposed to javascript, so that they can be used in the [FT8 Player](https://pengowray.github.io/).

## Source Code and License

https://github.com/pengowray/MSHV/

The in the _wasm_ folder of the _wasm_ branch, this fork of MSHV contains modifications to support web assembly compilation of a part of MSHV. 

The overall project follows WSJT-X and HSHV, with the source code available under the GPL v3.0. Additionally, the new and supporting source code (wrappers, tests and Qt replacement code), as well as the source code of [FT8 Player](https://pengowray.github.io/) is available under the MIT license.