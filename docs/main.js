import { FT8Message } from './ft8_msg.js';
import { inputToTabs } from './ft8_tabs.js';
import { ViewManager } from './views.js';
//import { VizComponent, PianoRollComponent, OutputComponent, TribbleComponent, PlayBtnComponent } from './components.js';
import { VizComponent } from './views_viz.js';
import { PianoRollComponent } from './views_piano.js';
import { TribbleComponent } from './views_bits.js';
import { OutputComponent } from './views_output.js';
import { PlayBtnComponent } from './views_play.js';
import { testInputs_ft8code, ft8_examples } from './ft8_tests.js';
import { getFT8MessageTypeName } from './ft8_extra.js';
import * as extra from './ft8_extra.js';

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
    const tabContainer = document.getElementById('tab-container');

    viewManager.registerComponent(new VizComponent(-99, audioVisualization));
    viewManager.registerComponent(new PianoRollComponent(-99, pianoRollDiv));
    viewManager.registerComponent(new OutputComponent(-99, output));
    viewManager.registerComponent(new TribbleComponent(-99, tribbleViz));
    viewManager.registerComponent(new PlayBtnComponent(-2, audioControls));

    const initializeTestInputs = () => {;
       
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

        //TODO: check if there's anything lost by not having these and only having the "expected" tab instead
        /*
        testInputs_ft8code.forEach((test, index) => {
            const option2 = document.createElement('option');
            option2.value = `ft8codeSymbols ${index}`;
            option2.textContent = `(${test.type}) ${test.message} (unpack)`;
            testSelect.appendChild(option2);
        });
        */

        testSelect.addEventListener('change', handleTestInputChange);
    }

    function handleTestInputChange(event) {
        const selected = event.target.value.split(' ');
        let selectedType = selected[0];
        let selectedIndex = parseInt(selected[1]);
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
                doEncode(nonTest);
            }
        }
    }

    initializeTestInputs();

    document.addEventListener('keydown', handleKeyboardShortcuts);

    function handleKeyboardShortcuts(event) {
        if (isEditableElement(document.activeElement)) {
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                changeTab(1);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                changeTab(-1);
            }
        } else if (event.shiftKey) {
            if (event.key === '.' || event.key === '>') {
                event.preventDefault();
                changeTestInput(1);
            } else if (event.key === ',' || event.key === '<') {
                event.preventDefault();
                changeTestInput(-1);
            }
        }
    }
    
    function isEditableElement(element) {
        return element.tagName === 'INPUT' || 
               element.tagName === 'TEXTAREA' || 
               element.isContentEditable;
    }
    
    function changeTab(direction) {
        const tabs = Array.from(tabContainer.children);
        const activeTabIndex = tabs.findIndex(tab => tab.classList.contains('active'));
        if (activeTabIndex !== -1) {
            const newIndex = (activeTabIndex + direction + tabs.length) % tabs.length;
            tabs[newIndex].click();
        }
    }

    function changeTestInput(direction) {
        const currentIndex = testSelect.selectedIndex;
        const newIndex = (currentIndex + direction + testSelect.options.length) % testSelect.options.length;
        testSelect.selectedIndex = newIndex;
        testSelect.dispatchEvent(new Event('change'));
    }

    const parseFreq = (note) => {
        return parseNote(note) || parseFloat(note) || 500;
    }

    const parseNote = (note) => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const flatToSharp = { 'DB': 'C#', 'EB': 'D#', 'GB': 'F#', 'AB': 'G#', 'BB': 'A#' };          

      if (typeof note !== 'string') return NaN;
      note = note.toUpperCase().replace('♭', 'B').replace('♯', '#');
      // TODO: ♭ should only be second letter; use detectNoteNotation instead?

      // Convert flat notation to sharp notation
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
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

      // Regular expression to match note notation
      
      const notePattern = /^([A-G])(#|B|♭|♯)?([+-]?\d+)?$/;
      const match = input.toUpperCase().match(notePattern);
      
      if (match) {
        const [, note, accidental, octave] = match;
        if (accidental === 'B' || accidental === '♭') accidental = 'b';
        if (accidental === '♯') accidental = '#';

        let returnNote = {
          isValid: true,
          noteInput: note + accidental + (parseInt(octave) || ''),
          note: flatToSharp[noteInput] || noteInput,
          //octaveInput: octave ? parseInt(octave) : null,
          octave: octave ? parseInt(octave) : 4,
          //accidentalInput: accidental || null,
        };
        if (!returnNote.note) return { isValid: false };

        const a4 = 440;
        returnNote.keyNumber = notes.indexOf(returnNote.note);
        returnNote.frequency = a4 * Math.pow(2, (notes.octave - 4) + (returnNote.keyNumber - 9) / 12);

        return returnNote;
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
        
        if (exception != null) {
            console.error("Exception", exception);
            strings.push(`Exception: ${exception}`);
            failed = true;
        }

        if (message && message.encodeError) {
            strings.push(`Encoding error: ${message.encodeError}`);
            failed = true;
        }

        if (!message) {
            strings.push(`No message object was created.`);
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

        //message = new FT8Message(inputText, testData);
        //message.encode();

        const tabs = inputToTabs(inputText, testData);
        //console.log('tabs', tabs);

        //const msg = tabs[0] ?? null;
        const msg = tabs.find(tab => tab.encodeError === null) || tabs[0] || null;

        changeToMessage(msg);
    }
    
    function handleTabSwitch(msg) {
        changeToMessage(msg);
    }
   
    /*
    function handleViewManagerTabSwitch(index) {
        if (viewManager.messages.length > index) {
            viewManager.switchToMessageIndex(index);
            updateTabUI(index);
        }
    }
    */

    function changeToMessage(msg) {
        //TODO: separate: views stuff and audio stuff and updateTabUI stuff (already in its own function)

        message = msg;

        updateTabUI();
        const hasErrors = handleError(msg); // will unhide messageContent if no errors
        
        if (msg == null || hasErrors) {
            viewManager.switchToMessageIndex(-1);
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

    function updateTabUI() {
        tabContainer.innerHTML = '';
        
        //const tabList = viewManager.messages;
        const tabList = message?.tabs;
        if (tabList == null) return;

        tabList.forEach((msg, index) => {
            const tabButton = document.createElement('button');
            if (msg == null) {
                console.log("null message in tab list at index", index);
            }
            if (msg.inputType != null && msg.inputType.length > 0) {
                // todo: inputTypeDescriptions[msg.type] + inputType
                //const typeName = msg.type;
                let typeInfo = msg.inputType;
                if (typeInfo != null && typeInfo.startsWith('default/')) {
                    typeInfo = typeInfo.slice(8);
                }

                if (msg.packetType == 'spp') {
                    tabButton.innerHTML = `Space Packet Protocol 🛰<br>${typeInfo}`;
                } else {

                    if (msg.ft8MessageType && msg.inputType && !['free text', 'telemetry'].includes(msg.inputType)) {
                        typeInfo += ' → ' + (extra.getFT8MessageTypeName(msg.ft8MessageType) || msg.ft8MessageType);
                    }

                    if (msg.bestDecodedResult?.success) { 
                        tabButton.innerHTML = `<b>${msg.bestDecodedResult.decodedText}</b><br>${typeInfo}`;
                    } else {
                        tabButton.innerHTML = typeInfo;
                    }
                }

            } else {
                tabButton.textContent = `Tab ${index + 1}`;
            }
            tabButton.classList.add('tab-button');
            //if (index === activeIndex) {
            if (msg === message) {
                tabButton.classList.add('active');
            } else if (!msg.encodeError && !message.encodeError && msg.bits === message.bits && msg.packetType == message.packetType) {
                tabButton.classList.add('equal');
            }

            //todo: warning too
            if (msg.encodeError) {
                tabButton.classList.add('error');
            }
            tabButton.onclick = () => handleTabSwitch(msg); // handleTabSwitch(index)
            tabContainer.appendChild(tabButton);
        });
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

}


/*
if (typeof Module !== 'undefined') {
    Module.onRuntimeInitialized = initializeUI;
} else {
    document.addEventListener('DOMContentLoaded', initializeUI);
}
*/

export { initializeUI };