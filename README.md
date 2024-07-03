# ft8 player by VK3PGO

Enter a short message, see it encoded, play the FT8 audio, download it.

What things mean:
- The number in a text box is the base frequency (default 500 Hz). FT8 output will range from the base to the base +50 Hz. 1000 Hz is often preferred for sending, but 500 Hz was more pleasant to listen to while building it.
- The number in the drop down is the sample rate (the frequency of the generated audio signal). 12000 Hz is the default. 44100 Hz is CD quality. If the base frequency is set to more than half the sample rate, you'll get fun aliases effects.
- "Play at Next 15s Slot" is an awkwardly named button which waits until the next FT8 window begins before playing audio. It's based on your device's clock. If you know javascript and have a way of getting a precise time from somewhere on the internet (ala [time.is](https://time.is/)), or if you have an idea for a more consise name for this button, please drop a message or a pull request.
- Stop Audio, stops the audio playing unless you encoded another message while it was playing because I haven't fixed that bug yet.

Message input formats:
- A standard FT8 message such as CQ, signal report, acknowledgement. Example: `CQ AA9GO QF22`. If FT8_lib fails to encode the text as a standard message, then ft8play attempts to encode it as a free text payload. FT8_lib does not yet support certain FT8 message types such as DXpedition mode and contests.
- `<FREE TEXT>` in pointy brackets, up to 13 characters. Valid characters are ` 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?` Your message will be uppercased.

Payload/symbol input formats: (for debugging or advanced uses)
- Payload as packed hex: Exactly 10 hexadecimal digits containing your 77-bit payload (zero-padded on the end, not the start). e.g. `5f a5 ec 39 30 6f aa c3 d6 00` Input may contain spaces or dashes between the bytes. This format is output by gen_ft8, a command line tool which comes as source code in FT8_lib
- Payload as packed binary string, exactly 77 digits: Example: `00001100001010010011101110000000010011011110111100011010111010100001100110001` This is a format displayed by the WSJT-X utility ft8code.exe, which it calls "Source-encoded message, 77 bits". Input can contain spaces.
- Symbols (exactly 79 symbols from 0-7, representing eight tones of FT8), for example: `3140652154634130077314147171333010263140652631713260022224072711662335223140652` May optionally contain spaces. This format is given as output by both gen_ft8 and ft8code.

Bugs
- It's a bit flaky and will break if you hit the generate button while audio is playing.
- Only fully supports standard messages and free text

Privacy:
- All processing is done on your local machine or device. Input is not sent anywhere except by you as audio.
