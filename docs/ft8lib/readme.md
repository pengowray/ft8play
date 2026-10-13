## About 

This is a web assembly port of [ft8_lib by Karlis Goba (YL3JG)](https://github.com/kgoba/ft8_lib) and other contributors, a library for encoding and decoding FT8 messages. It is based on the FT8 protocol as described by Joe Taylor (K1JT) and Steve Franke (K9AN).

ft8_lib is written in C and is designed to be used in amateur radio software. It is a lightweight FT8/FT4 decoder and encoder, initially intended for experimental use on microcontrollers.

## Version

This build is based on ft8_lib commit [9fec6ca](https://github.com/kgoba/ft8_lib/commit/9fec6ca39886edbf96f4f5e71edc76da5074e871) from 23 August 2025 ("non-standard callsigns; special CQ; field type annotation"), the latest upstream commit when the build was made. It was compiled with Emscripten 6.0.12 on 14 October 2026, from the _wasm_ branch of the fork at commit 3777168, which adds a streaming audio decoder (`rxft8`, used by `ft8_rx.js`).

## Source Code and License

https://github.com/pengowray/ft8_lib

In the _wasm_ folder of the _wasm_ branch, this fork of ft8_lib contains modifications and additional code to support web assembly compilation and usage.

The source code is available under the MIT license, the same as the original library,

The web assembly port was created for use in [FT8 Player](https://pengowray.github.io/) by Pengo Wray (VK3PGO), which is also available under the MIT license. It does not include the full functionality of the original library, such as FT4 support.