# FT8 Player by VK3PGO

**[FT8 Player](https://pengowray.github.io/ft8play/)** (`ft8play`) is an online tool to generate and visualize FT8 audio. It runs in a web page.

I made this webpage which will pack text into an FT8 message and let you explore the resulting data, signals and audio. It's an experiment in information design, a way to learn about FT8, a tool to test and debug FT8 software, and if you're an amateur radio operator, you can use it to better understand what you're transmitting and receiving. It's also something I can point to and say 'I made this'.

Web technology and development tools have been evolving dramatically, and this project was partly to test what was possible now. I've forked the libraries FT8_lib (a lightweight C library originally designed for embedded systems) and MSHV (a C++ port of WSJT-X, the original FT8 software written in Fortran). I've compiled them both into web assembly modules, with much custom code to wrap, extend the libraries and visualize the output in FT8 Player. Everything runs locally in a web page (it doesn't send inputs anywhere). The majority of the source code is plain Javascript. It supports most FT8 message types with complete breakdowns of every field.

I don't have plans to add audio decoding at this stage, though I do keep pondering the idea of building a full QSO-capable app that would run on a web browser on your phone, and connect to a radio through web serial.

Any feedback welcome. Let me know if you find some use for it or want to help develop it further.

**[Open FT8 Player](https://pengowray.github.io/ft8play/)**

Pengo VK3PGO


## How it works

Enter a short message, press encode, see it encoded, play the FT8 audio on your speaker or into your radio transceiver if you like. Pick one of the pre-made messages (near the bottom) if you just want to test it out.

## What even is FT8?

Joe Taylor invented and discovered the FT8 digital radio mode and the first known binary pulsar respectively. For amateur radio enthusiasts, JT's FT8 is now the most used digital mode. As a weak signal mode, it works in the most challenging condititons and has become the most popular way to make a long distance QSO (radio contact). On the other hand, Joe Taylor's binary star system is not popular with anyone. At a distance of twenty-one thousand light-years, it's just too far to go for a holiday.

To transmit FT8 farther than the bluetooth speaker connected to your phone you'll need to become a ham radio licensee, which you can do by tricking the right people into believing you understand how photons actually work. If you're allergic to licensing requirements and buying radio hardware, you can still listen to other people's online SDR radios and hunt down FT8 traffic, or you can try decoding the audio you generate in [FT8 Player](https://pengowray.github.io/ft8play/) using another app like WSJT-X (for desktop) or FT8CN (Android).

![Screenshot_20240704_072016_Firefox](https://github.com/pengowray/ft8play/assets/800133/1796e807-ed9d-46cf-9dc5-476e4973a823)
**Splitscreen Test: Decoding FT8 Player's audio on an Android phone.** The FT8 audio is played on the phone's speaker by the [FT8 Player web page](https://pengowray.github.io/ft8play/). The FT8CN app picks up the audio again using the device's built-in microphone and decodes it.

## Who's this even for?
- Me. I wanted to see if it could be made. One must trust one's obsessions.
- Anyone interesting in learning about FT8
- Amateur radio folk who want to better craft or understand FT8 messages.
- Developers of FT8 software, who might appreciate the ability to quickly check the validity and content of codewords, symbols, hex or binary payloads, etc.
- The future. Eventually it would be fun to make a fully functional FT8 QSO app which runs in the browser, with logging and and CAT control for various radios (via the web serial API), but that's some way away and would be a huge time sink so I'm trying not to think about it.

## What things are in the UI

- Lots of stuff now that I haven't documented, so you'll have to explore.
- Callsign hashes are displayed with Z-Base-32 encoding for easy conversion between 22, 12 and 10 bit hashes. The possible characters are: `ybndrfg8ejkmcpqxot1uwisza345h769`. The middle digit can be any of `ybnd`. Zero `0` is not valid Z-Base-32 and is used to mean 'unknown'. The part of the hash which is included in the field is underlined.
- Base Frequency (default 500 Hz). FT8 audio output will range from the base frequency to about 50 Hz above it. 1000 Hz is sometimes used as the default base frequency for certain applications, but 500 Hz is the default because it made for more pleasant listening while developing this.
- Sample Rate: the number of audio samples per second in your generated audio signal. 12000 Hz is the default. 44100 Hz is CD quality. If you set the base frequency to more than about half the sample rate, you'll get fun aliasing effects.
- "Play at Next 15s Slot" is an awkwardly named button which waits until the next FT8 window begins before playing audio. It's based on your device's clock. Please drop a message or a pull request if you know javascript and have a way of getting a precise time from somewhere on the internet (ala [time.is](https://time.is/)), or if you have an idea for a more consise name for this button.

## Message input formats

- You can input a standard FT8 message such as CQ, signal report, acknowledgement. Example: `CQ AA9GO QF22`. Several different encoding libraries and methods will be attempted to encode the text as a standard message or other formats, and you can click between them. Click the example messages and tests at the bottom of the page to test different messages.
- `"FREE TEXT"`. The message you write between the `"` and `"` will be uppercased and truncated to 13 characters. Valid characters are ` 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?`. You can send anything as free text in FT8.
- Telemetry data. Examples: `123456789ABCDEF012` `T:DEADCAFE`. Exactly 18 hexadecimal digits (first digit must be 0 to 7), or `T:` followed by 1 to 18 hex digits. 71-bits.
 
Payload/symbol input formats: (for debugging or advanced uses)
- FT8 payload as packed hex: Exactly 10 hexadecimal digits containing your 77-bit payload (zero-padded on the end, not the start). e.g. `5f a5 ec 39 30 6f aa c3 d6 00` Input may contain spaces or dashes between the bytes. This format is found in the output of gen_ft8, a command line tool which comes as source code in FT8_lib
- FT8 payload as packed binary string. 77 digits: Example: `00001100001010010011101110000000010011011110111100011010111010100001100110001` This is a format displayed by the WSJT-X utility ft8code.exe which calls it "Source-encoded message, 77 bits". Also accepted: 91-bits (message + 14 bit CRC), 174-bit codeword (message + CRC + LDPC), or 237 bits (the works including the sync symbols). You can even enter tribbles of grits if you like (see hidden html comment) <!-- (Tribbles of grits resemble 237 regular binary bits, but they're not regular at all because they're still Gray coded bits [grits], in groups of 3 bits [tribbles]. This mode takes 79 gray coded tribbles which are formed by directly translating the FT8 message's symbols (labeled 0 to 7 as pitch increases) to their naive binary values and concatinating them together without realizing you were meant to map them out of their gray code values to ordinary non-graycode base 2 binary first. I'm not sure why I'm even mentioning this optional input mode because if anyone uses it it's because they skipped the documentaiton, not because they read it. The grits can be detected because of the sync symbols are wrong. It might be fun to detect the use of grits even when there's no sync symbols by using the CRC or parity data but ft8play doesn't do that right now because how much free time do you think I have? The only reward will be getting to delete this part of the comment once I do it. Also If I add support for non-graycoded symbols I can delete this line.) --> You can use spaces anywhere you like to make binary strings easier to read.
- Symbols: Exactly 79 digits, zero to seven, representing the eight tones of FT8. For example: `3140652154634130077314147171333010263140652631713260022224072711662335223140652` Input may optionally contain spaces. This format is used within the output of both ft8code (wsjt-x) and gen_ft8 (ft8_lib). Perhaps someone is talented enough to edit the numbers into a melodic tune. You can also leave out the sync symbols and input the remaining 58 symbols.

## What are you even talking about?
- [Let me draw you a diagram](https://pengowray.github.io/ft8play/).

## Bugs
- You have to hit generate again after adjusting any audio settings.

## To do
- [ ] decode FT8 audio
- [X] fully support decoding of all ft8 message types
- [X] fully support encoding of all ft8 message types
- [ ] superfox mode
- [X] have suggestions for alternative encoding methods when available
- [ ] save the user's call and grid in a cookie if they like
- [ ] optimizations
- [ ] update MSHV to latest + better test coverage for Qt string replacement code
- [ ] FFT visualization
- [ ] lots of other things, but it's largely working and has the basics, so I'm happy to leave it as is for now.

## Thanks

Software libraries and data sources used:
 - [ft8_lib](https://github.com/kgoba/ft8_lib) (MIT) — which I've [forked to add wasm support](https://github.com/pengowray/ft8_lib/tree/wasm)
 - [MSHV Amateur Radio Software](http://lz2hv.org/mshv) (GPLv3) — [forked to add wasm support](https://github.com/pengowray/MSHV/tree/wasm)
 - [D3 javascript library](https://d3js.org/) ([ISC](https://github.com/d3/d3/blob/main/LICENSE))
 - [HamGridSquare.js](https://gist.github.com/stephenhouser/4ad8c1878165fc7125cb547431a2bdaa) (MIT) by Paul Brewer KI6CQ
 - [AD1C's _Contest Country Files_](https://www.country-files.com/contest/) (MIT) — ft8play includes `CTY.CSV` <!-- (same format as Aether/KLog) -->to show the country of a callsign.
 - WSJT / WSJT-X (GPLv3) — the original FT8 software. Although not used directly in this project, I have referenced the Fortran source, as have the authors of MSHV and FT8_lib. WSJT-X is the most widely used FT8 software and is considered the reference implementation of the FT8 protocol.
 
Thank you to the authors and contributors of these libraries and data sources—Joe Taylor K1JT and Steve Franke K9AN, who developed the FT8 protocol and WSJT-X, Karlis Goba YL3JG who created ft8_lib, Christo LZ2HV who ported WSJTX to C++ and develops MSHV, Jim Reisert AD1C who maintains the Amateur Radio Country Files, and the many other contributors who have collectively made this project possible.

## How to contribute

- Some entry points if you're looking to contribute code:
   - [ ] The 'explainer', which explains the meaning of QSO text in plain English, could be expanded to cover more cases. It's a lot of if-then-else statements. The code is simple and easy to follow. It's in `ft8_explain.js`. Find QSOs where the explainer doesn't make sense and add a new case.
   - [ ] If you're more into audio visual stuff, you could try to add a spectrogram or waterfall display of the audio. See `views_viz.js`; [wavesurfer.js](https://wavesurfer.xyz/example/spectrogram/?scroll) looks good.
   - [ ] Or try to work out what kind of .wav files WSJT-X is expecting from file > open.
   - [ ] If you're more of a mathematical or puzzle person, you could try porting or creating a solver for LDPC errors, and adding an interface to let ther user add a tab with the corrected message. So far there's a solver which attempts a single step of flipping the most wrong-looking bits.
   - [ ] Have you noticed this is just a to do list in second person?
   - [ ] If you're interested in information design, you could try designing and implementing a visualization of the graycode to binary conversion process in the blocks of bits data view that I should probably label with a better name. The challenge is to add gray code (the values of the symbols), so that when glancing at the diagram it is difficult to confuse the gray code and binary code.
   - [ ] If you want to force this tool to be something actually useful, you could try adding a way to decode FT8 audio.
   - [ ] If you're into messing with javascript, find a nice way to make the browser back button work within the tool, and make a url format for sharing messages.
   - [ ] If you're a developer of amateur radio software, learn to use [Git](https://en.wikipedia.org/wiki/Git).

- If you find a specific bug, please open an issue or pull request.
  
## Privacy
- All processing is done on your local machine or device. Your input is not sent anywhere.

## Licensing notes
- This project is Copyright 2024 Pengo Wray. It is dual licensed under GPLv3 and additionally, if used without the MSHV module, under [MIT](https://github.com/pengowray/ft8play/blob/main/LICENSE).
- All code is MIT licensed with the exceptions of the D3.js library, which uses the MIT-like [ISC](https://github.com/d3/d3/blob/main/LICENSE); and the MSHV-based code, which is licensed under GPLv3 (as is the WSJT/WSJT-X code it is based on).
- My wrapper code and additions to the MSHV code are also dual MIT and GPLv3 licensed ([github link](https://github.com/pengowray/MSHV/tree/wasm/wasm))
- My additions to [ft8_lib](https://github.com/kgoba/ft8_lib), are MIT licensed, like the original ([github link](https://github.com/pengowray/ft8_lib/tree/wasm/wasm))
- If you fork this project as a whole without removing the MSHV code, then your project must also be made available under GPLv3. If you remove the MSHV code, then you can follow the more relaxed MIT licensing.
- If you fork this project, do not use my name or callsigns in the fork's name without permission, but do link back to this project.

## Where can I use VK3PGO's FT8 Player? 
- [pengowray.github.io/ft8play/](https://pengowray.github.io/ft8play/) — FT8 Player live in your browser.
