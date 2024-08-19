const exampleMessages = [
    "CQ K1ABC FN42",
    "K1ABC W9XYZ -15",
    "W9XYZ K1ABC R-17",
    "K1ABC W9XYZ RRR",
    "W9XYZ K1ABC 73",
    "<TNX BOB 73 GL>"
];



function initializeUI() {
    //let currentTime = 0;

    let countdownInterval = null;
    
    const viewManager = new ViewManager();
    const messageManager = viewManager.messageManager;
    
    //const messageManager = new MessageManager(); // from ft8_msg.js
    //window.messageManager = new MessageManager();

    const encodeButton = document.getElementById('encode-button');
    const decodeButton = document.getElementById('decode-button'); // not used (yet)
    const messageInput = document.getElementById('message-input');
    const baseFreqInput = document.getElementById('base-freq-input');
    const audioInput = document.getElementById('audio-input');
    const encodeOutput = document.getElementById('output');
    const output = document.getElementById('output');
    const errorOutput = document.getElementById('error-output');
    const messageContent = document.getElementById('message-content');

    const toggleSettingsButton = document.getElementById('toggle-settings');
    const audioSettings = document.getElementById('audio-settings');
    const sampleRateSelect = document.getElementById('sample-rate-select');

    const audioControls = document.getElementById('audio-controls');
    const themeToggle = document.getElementById('theme-toggle');
    const exampleMessagesDiv = document.getElementById('example-messages');
    const pianoRollDiv = document.getElementById('piano-roll');
    const audioVisualization = document.getElementById('audio-visualization');
    const tribbleViz = document.getElementById('tribble-visualization');
    const testSelect = document.getElementById('test-select');

    viewManager.registerComponent(new VizComponent(-1, audioVisualization));
    viewManager.registerComponent(new PianoRollComponent(-1, pianoRollDiv));
    viewManager.registerComponent(new OutputComponent(-1, output));
    viewManager.registerComponent(new TribbleComponent(-1, tribbleViz));
    viewManager.registerComponent(new PlayBtnComponent(-2, audioControls));

    const initializeTestInputs = () => {;
        testInputs.forEach((test, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = test.name || test.value;
            testSelect.appendChild(option);
        });

        testSelect.addEventListener('change', (event) => {
            const selectedIndex = event.target.value;
            if (selectedIndex !== "") {
                const selectedTest = testInputs[selectedIndex];
                messageInput.value = selectedTest.value;
                doEncode();
            }
        });
    }
    //initializeTestInputs();

    const initializeTestInputs_ft8code = () => {;
        ft8_examples.forEach((test, index) => {
            const option = document.createElement('option');
            option.value = `example ${index}`;
            option.textContent = test.name || test.value;
            testSelect.appendChild(option);
        });

        testInputs_ft8code.forEach((test, index) => {
            const option = document.createElement('option');
            option.value = `ft8codeMsg ${index}`;
            option.textContent = `(${test.type}) ${test.message}`;
            testSelect.appendChild(option);
        });

        testInputs_ft8code.forEach((test, index) => {
            const option2 = document.createElement('option');
            option2.value = `ft8codeSymbols ${index}`;
            option2.textContent = `(${test.type}) ${test.message} (unpack)`;
            testSelect.appendChild(option2);
        });

        testSelect.addEventListener('change', (event) => {
            const selected = event.target.value.split(' ');
            selectedType = selected[0];
            selectedIndex = parseInt(selected[1]);
            if (selectedIndex !== "") {
                if (selectedType === 'ft8codeMsg') {
                    const selectedTest = testInputs_ft8code[selectedIndex];
                    messageInput.value = selectedTest.message;
                    const expectedResults = { ...selectedTest, testType: selectedType};
                    doEncode(expectedResults);
                } else if (selectedType === 'ft8codeSymbols') {
                    const selectedTest = testInputs_ft8code[selectedIndex];
                    messageInput.value = selectedTest.symbols;
                    const expectedResults = {...selectedTest, ...{symbols:null}, testType: selectedType}; // don't bother testing symbols when they're in the input
                    doEncode(expectedResults);
                } else if (selectedType === 'example') {
                    const selectedTest = ft8_examples[selectedIndex];
                    messageInput.value = selectedTest.value;
                    const nonTest = { ...selectedTest, testType: selectedType};
                    doEncode(nonTest); // to add a comment
                }
            }
        });
    }
    initializeTestInputs_ft8code();

    const parseFreq = (note) => {
        return parseNote(note) || parseFloat(note) || 500;
    }

    const parseNote = (note) => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      //const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
      const flatToSharp = { 'DB': 'C#', 'EB': 'D#', 'GB': 'F#', 'AB': 'G#', 'BB': 'A#' };          
      // Validate input

      if (typeof note !== 'string') return NaN;
      note = note.toUpperCase();
      
      // Convert flat notation to sharp notation if necessary
      //let normalizedNote = note.replace(/([A-G])b(\d?)$/, (_, noteLetter, octave) => 
      //  (flatToSharp[noteLetter + 'b'] || noteLetter + 'b') + octave
      //);
      let normalizedNote = note.replace(/([A-G])B(\d?)$/, (_, noteLetter, octave) => 
        (flatToSharp[noteLetter + 'B'] || noteLetter + 'B') + octave
      );
      
      const octave = parseInt(normalizedNote.slice(-1)) || 4;
      const noteWithoutOctave = normalizedNote.replace(/\d+$/, '');
      const keyNumber = notes.indexOf(noteWithoutOctave);
      
      if (keyNumber === -1) return NaN;
      
      const a4 = 440;
      return a4 * Math.pow(2, (octave - 4) + (keyNumber - 9) / 12);
    };

    function detectNoteNotation(input) {
      // Regular expression to match note notation
      //const notePattern = /^([A-G](#|b)?)(\d)?$/;
      const notePattern = /^([A-G](#|B)?)(\d)?$/;
      const match = input.toUpperCase().match(notePattern);
      
      if (match) {
        const [, note, accidental, octave] = match;
        return {
          isValid: true,
          note: note,
          accidental: accidental || null,
          octave: octave ? parseInt(octave) : null
        };
      } else {
        return { isValid: false };
      }
    }

    function parseFrequencyInput(input) {
        input = input.trim();
        
        // easter eggs
        if (input === "-73") {
            input = "440 (E4 G4 C5 D5 E5 F5 G5 A5)"; // C major / mario3
        } else if (input === "-1") {
            input = "440 (C4 D4 D#4 F4 G4 A#4 C5 G5)"; // C minor / underworld
        }

        // Default base frequency if not provided
        let baseFreq = 500;

        // Try to parse base frequency
        //const baseFreqMatch = input.match(/^(\d+(\.\d+)?)/);
        const baseFreqMatch = input.match(/^\s*(\S*)[\s\(]?/);
        if (baseFreqMatch) {
            baseFreq = parseFreq(baseFreqMatch[1]) || baseFreq;
        }

        // Check for offsets in brackets
        const offsetsMatch = input.match(/\((.*?)\)/);
        
        // If no offsets provided, use default FT8 spacing
        if (!offsetsMatch) {
            return defaultTonesFT8(baseFreq); 
        }

        //todo: perhaps treat customTones as offsets if start with +
        //todo: most verbose, json based notation
        const customTonesStr = offsetsMatch[1].trim();
        const customTonesTokens = customTonesStr.split(/\s+/);
        let customTones = [];

        customTones = customTonesTokens.map(token => parseNote(token) || parseFloat(token) || NaN); 

        // Fill in missing offsets
        if (customTones.length === 1) {
            //const step = offsets[0] / 7;
            let step = customTones[0] - baseFreq;
            if (step == 0) step = 6.25;
            customTones = Array.from({length: 8}, (_, i) => baseFreq + i * step);
        } else if (customTones.length < 8) {
            while (customTones.length < 8) {
                const step = customTones[customTones.length - 1] - customTones[customTones.length - 2];
                customTones.push(customTones[customTones.length - 1] + step);
            }
        } else if (customTones.length > 8) {
            //todo: show error to user
            console.log("Too many custom tones.");
            //return defaultTonesFT8(baseFreq); 
            return { baseHz: baseFreq, customTones: customTones.slice(0, 7) };
        }
        return { baseHz: baseFreq, customTones: customTones };
    }

    function defaultTonesFT8(baseHz) {
        const offsets = [0, 6.25, 12.5, 18.75, 25, 31.25, 37.5, 43.75];
        return { baseHz: baseHz, customTones: offsets.map( offset => baseHz + offset) };
    }


    messageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            encodeButton.click();
        }
    });


    encodeButton.addEventListener('click', () => {
        doEncode();
    });
    
    // Message from handleEncode, is in this scope so we can get encoding errors out more easily.
    let message = null; // type {FT8Message}

    function doEncode(testData = null) {
        try {
            handleEncode(testData);
            const hasErrors = handleError(message);
         
        } catch (error) {
            handleError(message, error);
        }
    }
    
    // displays errors
    // returns true if there are errors
    function handleError(message, exception = null) {
        let strings = [];
        let failed = false;
        
        if (message.encodeError_ft8lib) {
            strings.push(`ft8_lib error: ${message.encodeError_ft8lib}`);
            // not failure yet (may have fallen back to freetext)
        }
        if (exception != null) {
            console.error("exception", exception);
            strings.push(`Exception: ${exception}`);
            failed = true;
        }
        if (message.error) {
            strings.push(`General error: ${message.error}`);
            failed = true;
        }
        if (message.encodeError) {
            strings.push(`encoding error: ${message.encodeError}`);
            failed = true;
        }
        
        if (failed) {
            errorOutput.style.display = 'block';
            messageContent.style.display = 'none';
            errorOutput.innerHTML = strings.join("<br>");
            return true;
        } else {
            errorOutput.innerHTML = '';
            errorOutput.style.display = 'none';
            messageContent.style.display = 'block';
            return false;
        }
        
    }
    
    function handleEncode(testData = null) {
        let inputText = messageInput.value;
        message = new FT8Message(inputText); //messageManager.createMessage(inputText);
        message.expectedResults = testData;

        message.encode();
        if (message.error != null) {
            return;
        }

        // gather audio options
        const freqData = parseFrequencyInput(baseFreqInput.value);
        if (!freqData) {
            throw new Error("Invalid frequency input");
        }
        //console.log(`freq: ${freqData.baseHz} (${freqData.customTones.join(' ')})`);
        const sampleRate = parseInt(sampleRateSelect.value);
        message.setAudioOptions(sampleRate, freqData.baseHz, freqData.customTones);

        //const { audio, dphi, metadata } = generateAudioFromSymbols(symbolsArray, baseFrequency, sampleRate);
        //const audioResult = generateAudioFromSymbols(symbolsArray, options);
        message.generateAudio();

        const index = viewManager.addMessage(message);
        viewManager.switchToMessageIndex(index);

        if (message.audioSamples.length > 0) {
            //setupAudioPlayback(message);
        } else {
            throw new Error("Error generating audio data generated");
        }
    }

    exampleMessages.forEach(message => {
        const button = document.createElement('button');
        button.textContent = message;
        button.addEventListener('click', () => {
            messageInput.value = message;
            doEncode();
        });
        exampleMessagesDiv.appendChild(button);
    });


    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    toggleSettingsButton.addEventListener('click', () => {
        audioSettings.classList.toggle('hidden');
        toggleSettingsButton.textContent = audioSettings.classList.contains('hidden') 
            ? 'Audio Settings ▼' 
            : 'Audio Settings ▲';
    });

    // Populate sample rate dropdown
    const sampleRates = [8000, 11025, 12000, 16000, 22050, 24000, 44100, 48000];
    sampleRates.forEach(rate => {
        const option = document.createElement('option');
        option.value = rate;
        option.textContent = `${rate} Hz`;
        if (rate === 12000) option.selected = true;
        sampleRateSelect.appendChild(option);
    });

    const toggleVisualizationButton = document.getElementById('toggle-visualization');
    const VisualizationCaption = document.getElementById('visualization-caption');

    //TODO XXX
    //toggleVisualizationButton.addEventListener('click', toggleVisualization);

}

/*
if (typeof Module !== 'undefined') {
    Module.onRuntimeInitialized = initializeUI;
} else {
    document.addEventListener('DOMContentLoaded', initializeUI);
}
*/