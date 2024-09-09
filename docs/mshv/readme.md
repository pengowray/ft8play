## About 

This is a web assembly port of [MSHV Amateur Radio Software](http://lz2hv.org/mshv) by LZ2HV ([sourceforge link](https://sourceforge.net/projects/mshv/)). 

MSHV is multiplatform software designed for use by amateur radio afficinados. It supports many radio modes: MSK JTMS FSK ISCAT JT6M FT8/4 JT65 PI4 Q65. It builds on the open source work of Joe Taylor (K1JT), Steve Franke (K9AN) and many others, which is available in the open source WSJT-X software.

MSHV is written in C++ and uses the Qt framework. This port is a subset of the original software, focusing on the FT8 mode. It is compiled to web assembly using emscripten. MSHV's FT8 pack/unpack functions are exposed to javascript, so that they can be used in the [FT8 Player](https://pengowray.github.io/).

## Source Code and License

https://github.com/pengowray/MSHV/

The above github repository is a fork of MSHV, containing source code with modifications to support web assembly compilation of parts of the MSHV program. The relevant code is found in the _wasm_ folder of the _wasm_ branch. It contains emscripten compilation and testing scripts.

The FT8 Player project includes code from HSHV, and is as such, also available under the GPLv3. Additionally, the FT8 Player project and its source code, excluding MSHV modules and MSHV source code, are available under the MIT license. The MIT license also extends to the new and supporting source code for MSHV by Pengo Wray, such as wrappers, tests and Qt replacement code.