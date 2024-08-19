# FT8 Player by VK3PGO

**[FT8 Player](https://pengowray.github.io/ft8play/)** (`ft8play`) is an online tool to generate and visualize FT8 audio. It runs in a web page.

I made this webpage which will pack text into FT8, visualize it in various ways and play it as audio. I thought someone might find a use for it.

It will also take an encoded FT8 message (in whatever text representation you can throw at it) and give you a breakdown of the contents.

It uses FT8_Lib for decoding (which is also used by KiwiSDR), as well as custom code to extract additional message types and fields. It will also highlight CRC and LDPC errors. Everything runs locally in a web page (it doesn't send inputs anywhere). The source code is plain javascript. FT8_lib is written in C and I've compiled it to wasm (web assembly).

I don't have plans to add audio decoding at this stage, though I do keep pondering it and dreaming about building up a full QSO-capable app that would run on a phone's browser.

Any feedback welcome. Let me know if you find some use for it or want to help develop it.

**[Open FT8 Player](https://pengowray.github.io/ft8play/)**

Pengo VK3PGO


## How it works

Enter a short message, press encode, see it encoded, play the FT8 audio on your speaker or into your radio transceiver if you like. Pick one of the pre-made messages (near the bottom) if you just want to test it out.

## What even is FT8?

Joe Taylor invented and discovered the FT8 digital radio mode and the first known binary pulsar respectively. For amateur radio enthusiasts, FT8 is possibly the most used digital mode. As a weak signal mode, it works in the most challenging condititons and is becoming the most popular way to make an international connection. On the other hand, Joe's binary star system is not popular with anyone. At a distance of twenty-one thousand lightyears, it is just too far to get there.

To transmit FT8 farther than the bluetooth speaker connected to your phone you'll need to become a ham radio licensee, which you can do by tricking the right people into believing you understand how photons really work. If you're allergic to licensing requirements and buying radio hardware, you can still listen to other people's online SDR radios and hunt down FT8 traffic, or you can try decoding the audio you generate in [FT8 Player](https://pengowray.github.io/ft8play/) using an app like WSJT-X (for desktop) or FT8CN (Android).

![Screenshot_20240704_072016_Firefox](https://github.com/pengowray/ft8play/assets/800133/1796e807-ed9d-46cf-9dc5-476e4973a823)
**Splitscreen Test: Decoding FT8 Player's audio on an Android phone.** The FT8 audio is played on the phone's speaker by the [FT8 Player web page](https://pengowray.github.io/ft8play/). The FT8CN app picks up the audio again using the device's built-in microphone and decodes it.

## Who's this even for?
- Me. I wanted to see if it could be made. One must trust one's obsessions.
- Anyone interesting in learning about FT8
- Amateur radio folk who want to better craft or understand FT8 messages.
- Developers of FT8 software, who might appreciate the ability to quickly check the validity and content of codewords, symbols, hex or binary payloads, etc.
- The future. Eventually it would be fun to make a fully functional FT8 QSO app which runs in the browser, with logging and and CAT control for various radios (via the web serial API), but that's some way away and would be a huge time sink so I'm trying not to think about it.

## What things are in the UI

- Callsign hashes are displayed with Z-Base-32 encoding for easy conversion between 22, 12 and 10 bit hashes. The possible characters are: `ybndrfg8ejkmcpqxot1uwisza345h769`. The middle digit can be any of `ybnd`. Zero `0` is not valid Z-Base-32 and is used to mean 'unknown'. The part of the hash which is included in the field is underlined.
- Base Frequency (default 500 Hz). FT8 audio output will range from the base frequency to about 50 Hz above it. 1000 Hz is sometimes used as the default base frequency for certain applications, but 500 Hz is the default because it made for more pleasant listening while developing this.
- Sample Rate: the number of audio samples per second in your generated audio signal. 12000 Hz is the default. 44100 Hz is CD quality. If you set the base frequency to more than about half the sample rate, you'll get fun aliasing effects.
- "Play at Next 15s Slot" is an awkwardly named button which waits until the next FT8 window begins before playing audio. It's based on your device's clock. Please drop a message or a pull request if you know javascript and have a way of getting a precise time from somewhere on the internet (ala [time.is](https://time.is/)), or if you have an idea for a more consise name for this button.

## Message input formats

- You can input a standard FT8 message such as CQ, signal report, acknowledgement. Example: `CQ AA9GO QF22`. If FT8_lib fails to encode the text as a standard message, then ft8play attempts to encode it as a free text payload. FT8_lib does not yet support certain FT8 message types such as DXpedition mode and contests, but FT8play will decode the fields of these now anyway. Click the example messages at the bottom of the page to test different messages.
- `<FREE TEXT>`. The message you write between the `<` and `>` will be uppercased and truncated to 13 characters. Valid characters are ` 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?`. You can send anything as free text in FT8.
- Telemetry data. Examples: `123456789ABCDEF012` `T:DEADCAFE`. Exactly 18 hexadecimal digits (first digit must be 0 to 7), or `T:` followed by 1 to 18 hex digits. 71-bits.
 
Payload/symbol input formats: (for debugging or advanced uses)
- FT8 payload as packed hex: Exactly 10 hexadecimal digits containing your 77-bit payload (zero-padded on the end, not the start). e.g. `5f a5 ec 39 30 6f aa c3 d6 00` Input may contain spaces or dashes between the bytes. This format is found in the output of gen_ft8, a command line tool which comes as source code in FT8_lib
- FT8 payload as packed binary string. 77 digits: Example: `00001100001010010011101110000000010011011110111100011010111010100001100110001` This is a format displayed by the WSJT-X utility ft8code.exe which calls it "Source-encoded message, 77 bits". Also accepted: 91-bits (message + 14 bit CRC), 174-bit codeword (message + CRC + LDPC), or 237 bits (the works including the sync symbols). You can even enter tribbles of grits if you like (see hidden html comment) <!-- (Tribbles of grits resemble 237 regular binary bits, but they're not regular at all because they're still Gray coded bits [grits], in groups of 3 bits [tribbles]. This mode takes 79 gray coded tribbles which are formed by directly translating the FT8 message's symbols (labeled 0 to 7 as pitch increases) to their naive binary values and concatinating them together without realizing you were meant to map them out of their gray code values to ordinary non-graycode base 2 binary first. I'm not sure why I'm even mentioning this optional input mode because if anyone uses it it's because they skipped the documentaiton, not because they read it. The grits can be detected because of the sync symbols are wrong. It might be fun to detect the use of grits even when there's no sync symbols by using the CRC or parity data but ft8play doesn't do that right now because how much free time do you think I have? The only reward will be getting to delete this part of the comment once I do it. Also If I add support for non-graycoded symbols I can delete this line.) --> You can use spaces anywhere you like to make binary strings easier to read.
- Symbols: Exactly 79 digits, zero to seven, representing the eight tones of FT8. For example: `3140652154634130077314147171333010263140652631713260022224072711662335223140652` Input may optionally contain spaces. This format is used within the output of both ft8code (wsjt-x) and gen_ft8 (ft8_lib). Perhaps someone is talented enough to edit the numbers into a melodic tune. You can also leave out the sync symbols and input the remaining 58 symbols.

## What are you even talking about?
- [Let me draw you a diagram](https://pengowray.github.io/ft8play/).

## Bugs
- You have to hit generate again after adjusting any audio settings.
- Not all information presented is correct.
- The audio ramps are wrong, which is probably causing WSJT-X to not to decode the generated .wav files (though it decodes the audio signal consistantly when presented in other ways)

## To do
- [ ] decode FT8 audio
- [X] fully support decoding of all ft8 message types
- [ ] fully support encoding of all ft8 message types
- [ ] superfox mode
- [ ] have the UI suggest alternative encoding methods when available
- [ ] save the user's call and grid in a cookie if they like
- [ ] optimizations
- [ ] FFT visualization
- [ ] rework the UI
- [ ] lots of other things, but it's largely working and has the basics, so I'm happy to leave it as is for now.

## Thanks

Software libraries and data sources used:
 - [ft8_lib](https://github.com/kgoba/ft8_lib) (MIT) — which I've [forked to add emscripten (wasm) support](https://github.com/pengowray/ft8_lib/tree/ft8_wasm)
 - [D3 javascript library](https://d3js.org/)
 - [HamGridSquare.js](https://gist.github.com/stephenhouser/4ad8c1878165fc7125cb547431a2bdaa) (MIT) by Paul Brewer KI6CQ
 - [AD1C's _Contest Country Files_](https://www.country-files.com/contest/) ft8play includes `CTY.CSV` <!-- (same format as Aether/KLog) -->to show the country of a callsign.

## Privacy
- All processing is done on your local machine or device. Your input is not sent anywhere.

## Licence notes
- If you fork this project, do not use my name or callsigns in the fork's name without permission, but do link back to this project.

## Where can I use VK3PGO's FT8 Player? 
- [pengowray.github.io/ft8play/](https://pengowray.github.io/ft8play/) — FT8 Player live in your browser.
