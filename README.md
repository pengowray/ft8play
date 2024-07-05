# FT8 Player by VK3PGO

[FT8 Player](https://pengowray.github.io/ft8play/) (ft8play) is a tool to generate and visualize FT8 audio. It runs in a web page.

How it works: Enter a short message, press encode, see it encoded, play the FT8 audio on your speaker or into your radio trasceiver if you like.

FT8 is a digital chat mode designed by Joe Taylor, the first human to ever notice a binary pulsar. The mode is popular with amateur radio enthusiasts who use it to fill the airwaves across the world with the sound of R2-D2 gargling.

To transmit FT8 long distance you'll need to become a ham radio licensee, which you can do by tricking the right people into believing you understand how photons work. You'll also need a radio. Or you can just play FT8 on your speakers and hope someone out there hears your message. It can be picked up through a lot of noise. Or see if you can decode it yourself with an FT8 app like WSJT-X.

![Screenshot_20240704_072016_Firefox](https://github.com/pengowray/ft8play/assets/800133/1796e807-ed9d-46cf-9dc5-476e4973a823)
**Splitscreen Test: Decoding FT8 Player's audio on an Android phone.** The FT8 audio is played on the phone's speaker by the [FT8 Player web page](https://pengowray.github.io/ft8play/). The audio is picked up by the FT8CN app using the device's built-in microphone and decoded.

What things are in the UI:
- The number in a text box is the base frequency (default 500 Hz). FT8 audio output will range from the base frequency to 50 Hz above it. 1000 Hz is often preferred for certain setups, but 500 Hz is the default because it made for more pleasant listening while building this app.
- The number in the drop down is the sample rate (the number of audio samples per second in your generated audio signal). 12000 Hz is the default. 44100 Hz is CD quality. If you set the base frequency to more than about half the sample rate, you'll get fun aliasing effects.
- "Play at Next 15s Slot" is an awkwardly named button which waits until the next FT8 window begins before playing audio. It's based on your device's clock. Please drop a message or a pull request if you know javascript and have a way of getting a precise time from somewhere on the internet (ala [time.is](https://time.is/)), or if you have an idea for a more consise name for this button.
- Stop Audio, stops the audio playing unless you've encoded another message while it was playing because I haven't fixed that bug yet.
- "Decoded:" — this turns red if your encoded message text does not exactly match your input message. Currently for standard message types only.

Message input formats:
- A standard FT8 message such as CQ, signal report, acknowledgement. Example: `CQ AA9GO QF22`. If FT8_lib fails to encode the text as a standard message, then ft8play attempts to encode it as a free text payload. FT8_lib does not yet support certain FT8 message types such as DXpedition mode and contests. Click the example messages at the bottom of the page to test different messages.
- `<FREE TEXT>`. The message you write between the `<` and `>` will be uppercased and truncated to 13 characters. Valid characters are ` 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?`
- Telemetry data. Examples: `123456789ABCDEF012` `T:DEADCAFE`. Exactly 18 hexadecimal digits (first digit must be 0 to 7), or `T:` followed by 1 to 18 hex digits. 71-bits.
 
Payload/symbol input formats: (for debugging or advanced uses)
- FT8 payload as packed hex: Exactly 10 hexadecimal digits containing your 77-bit payload (zero-padded on the end, not the start). e.g. `5f a5 ec 39 30 6f aa c3 d6 00` Input may contain spaces or dashes between the bytes. This format is found in the output of gen_ft8, a command line tool which comes as source code in FT8_lib
- FT8 payload as packed binary string. 77 digits: Example: `00001100001010010011101110000000010011011110111100011010111010100001100110001` This is a format displayed by the WSJT-X utility ft8code.exe which calls it "Source-encoded message, 77 bits". Input may contain spaces. Also accepted: 91-bits (message + 14 bit CRC), 174-bit codeword (message + CRC + LDPC). Spaces are ignored.
- Symbols: Exactly 79 digits, zero to seven, representing the eight tones of FT8. For example: `3140652154634130077314147171333010263140652631713260022224072711662335223140652` Input may optionally contain spaces. This format is used within the output of both ft8code (wsjt-x) and gen_ft8 (ft8_lib). Perhaps someone is talented enough to edit the numbers into a melodic tune.

Bugs
- It's a bit flaky and will break if you hit the "generate" button while audio is still playing.

Todo:
- [ ] decode FT8 audio
- [ ] fully support encoding and decoding of all ft8 message types, and break down all parts of the message
- [ ] have UI suggest alternative encoding methods when available
- [ ] optimizations
- [ ] FFT visualization
- [ ] rework the UI
- [ ] lots of other things, but it's largely working and has the basics, so I'm happy to leave it as is for now.

Software libraries used:
 - [My fork of ft8_lib with emscripten (wasm) support added](https://github.com/pengowray/ft8_lib/tree/ft8_wasm)
 - [D3 javascript library](https://d3js.org/)

Privacy:
- All processing is done on your local machine or device. Your input is not sent anywhere except by you, as audio.

Where can I use VK3PGO's FT8 Player? 
- [pengowray.github.io/ft8play/](https://pengowray.github.io/ft8play/)
