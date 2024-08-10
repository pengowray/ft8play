const annotationDefinitions = {
    "0.0": [ // Free text
        { label: "Free text", start: 0, length: 71, getValue: (bits) => bitsToText(bits.slice(0, 71)) },
        { label: "i3.n3", start: 71, length: 6, getValue: (bits) => `0.0` }
    ],
    "0.1": [ // DXpedition mode: c28 c28 h10 r5
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)) },
        { label: "Call2", start: 28, length: 28, getValue: (bits) => bitsToCall(bits.slice(28, 56)) },
        { label: "Hash", start: 56, length: 10, getValue: (bits) => bitsToHash(bits.slice(56, 66)) },
        { label: "Report", start: 66, length: 5, getValue: (bits) => bitsToReport(bits.slice(66, 71)) },
        { label: "i3.n3", start: 71, length: 6, getValue: (bits) => `0.1` }
    ],
    "0.2": [ // EU VHF Contest
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)).callsign },
        { label: "Call2", start: 28, length: 28, getValue: (bits) => bitsToCall(bits.slice(28, 56)).callsign },
        { label: "R", start: 56, length: 1, getValue: (bits) => bits[56] === '1' ? 'R' : '' },
        { label: "Serial", start: 57, length: 13, getValue: (bits) => placeholder(bits.slice(57, 70)) },
        { label: "i3.n3", start: 71, length: 6, getValue: (bits) => `0.2` }
    ],
    "0.3": [ // ARRL Field Day
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)) },
        { label: "Call2", start: 28, length: 28, getValue: (bits) => bitsToCall(bits.slice(28, 56)) },
        { label: "R", start: 56, length: 1, getValue: (bits) => bits[56] === '1' ? 'R' : '' },
        { label: "nTx", start: 57, length: 4, getValue: (bits) => bitsToTxNumber(bits.slice(57, 61)) },
        { label: "Class", start: 61, length: 3, getValue: (bits) => bitsToFieldDayClass(bits.slice(61, 64)) },
        { label: "Section", start: 64, length: 7, getValue: (bits) => bitsToARRLSection(bits.slice(64, 71)) },
        { label: "i3.n3", start: 71, length: 6, getValue: (bits) => `0.4` }
    ],
    "0.4": [ // ARRL Field Day (alternate format) c28 c28 R1 n4 k3 S7
        //n4 Number of transmitters: 1-16, 17-32
        //S7 ARRL/RAC Section
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)) },
        { label: "Call2", start: 28, length: 28, getValue: (bits) => bitsToCall(bits.slice(28, 56)) },
        { label: "R", start: 56, length: 1, getValue: (bits) => bits[56] === '1' ? 'R' : '' },
        { label: "nTx", start: 57, length: 4, getValue: (bits) => bitsToTxNumber(bits.slice(57, 61)) },
        { label: "Class", start: 61, length: 3, getValue: (bits) => bitsToFieldDayClass(bits.slice(61, 64)) },
        { label: "Section", start: 64, length: 7, getValue: (bits) => bitsToARRLSection(bits.slice(64, 71)) },
        { label: "i3.n3", start: 71, length: 6, getValue: (bits) => `0.4` }
    ],
    "0.5": [ // Telemetry
        { label: "Telemetry", start: 0, length: 71, getValue: (bits) => bitsToTelemetry(bits.slice(0, 71)) },
        { label: "i3.n3", start: 71, length: 6, getValue: (bits) => `0.5` }
    ],
    "1": [ // Standard message
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)) },
        //{ label: "r1", start: 28, length: 1, getValue: (bits) => placeholder(bits.slice(28, 29)) },
        { label: "r", start: 28, length: 1, getValue: (bits) => bits[28] === '1' ? '/R' : '' },
        { label: "Call2", start: 29, length: 28, getValue: (bits) => bitsToCall(bits.slice(29, 57)) },
        //{ label: "r1", start: 57, length: 1, getValue: (bits) => placeholder(bits.slice(57, 58)) },
        { label: "r", start: 57, length: 1, getValue: (bits) => bits[57] === '1' ? '/R' : '' },
        //{ label: "R", start: 58, length: 1, getValue: (bits) => placeholder(bits.slice(58, 59)) },
        { label: "R", start: 58, length: 1, getValue: (bits) => bits[58] === '1' ? 'R' : '' },
        { label: "Grid/Report", start: 59, length: 15, getValue: (bits) => bitsToGrid4OrReportWithType(bits.slice(59, 74)) },
        { label: "i3", start: 74, length: 3, getValue: (bits) => `1` }
    ],
    "2": [ // EU VHF Contest
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)) },
        { label: "Call2", start: 29, length: 28, getValue: (bits) => bitsToCall(bits.slice(29, 57)) },
        { label: "R", start: 58, length: 1, getValue: (bits) => bits[58] === '1' ? 'R' : '' },
        { label: "Grid4", start: 59, length: 15, getValue: (bits) => bitsToGrid4OrReportWithType(bits.slice(59, 74)) },
        { label: "i3", start: 74, length: 3, getValue: (bits) => `2` }
    ],
    "3": [ // ARRL RTTY Roundup
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)) },
        { label: "Call2", start: 28, length: 28, getValue: (bits) => bitsToCall(bits.slice(28, 56)) },
        { label: "R", start: 56, length: 1, getValue: (bits) => bits[56] === '1' ? 'R' : '' },
        { label: "RST", start: 57, length: 3, getValue: (bits) => bitsToRST(bits.slice(57, 60)) },
        { label: "Serial/State", start: 60, length: 14, getValue: (bits) => bitsToSerialOrState(bits.slice(60, 74)) },
        { label: "i3", start: 74, length: 3, getValue: (bits) => `3` }
    ],
    "4": [ // Non-standard call: h12 c58 h1 r2 c1
        { label: "Hash", start: 0, length: 12, getValue: (bits) => bitsToHash(bits.slice(0, 12)) },
        { label: "Nonstandard Call", start: 12, length: 58, getValue: (bits) => bitsToNonstandardCall(bits.slice(12, 70)) },
        { label: "h", start: 70, length: 1, getValue: (bits) => bits[70] === '1' ? '1 (Hash is second callsign)' : '0 (Hash is first callsign)' },
        { label: "r2", start: 71, length: 2, getValue: (bits) => bitsToR2(bits.slice(71, 73)) },
        { label: "c", start: 73, length: 1, getValue: (bits) => bits[70] === '1' ? '1 (First callsign is CQ. Ignore hash)' : '0' },
        { label: "i3", start: 74, length: 3, getValue: (bits) => `4` }
    ],
    "5": [ // EU VHF Contest with 6-digit grid locator
        { label: "Call1", start: 0, length: 28, getValue: (bits) => bitsToCall(bits.slice(0, 28)) },
        { label: "Call2", start: 28, length: 28, getValue: (bits) => bitsToCall(bits.slice(28, 56)) },
        { label: "R", start: 56, length: 1, getValue: (bits) => bits[56] === '1' ? 'R' : '' },
        { label: "Grid6", start: 57, length: 17, getValue: (bits) => bitsToGrid6(bits.slice(57, 74)) },
        { label: "i3", start: 74, length: 3, getValue: (bits) => `5` }
    ]
};

//TODO

function bitsToTelemetry(bits) {
    return telemetryToText(bits);
}

function bitsToGrid6(bits) {
    return placeholder(bits);
}

function bitsToHash(bits) {
    // if (bits.length == 22) return hashBits22styleBase10(bits); // 
    //return hashBitsPrettyHex(bits);
    return hashBitsPrettyZ32(bits);
    
}
function bitsToSerialOrState(bits) {
    return placeholder(bits);
}
function placeholder(bits) {
    return `${parseInt(bits, 2).toString()} (undecoded value)`;
}


class TribbleComponent extends Component {
    constructor(index, container) {
        super(index, container);
        this.gridContainer = null;
        this.currentSymbol = 0;
        this.rows = [ 'packed', 'symbols', 'bits', 'annotations'];
        this.interval = null;
    }

    create() {
        this.gridContainer = document.createElement('div');
        this.gridContainer.className = 'bits-grid-container';
        this.container.appendChild(this.gridContainer);

        //this.createToggleButtons();
    }

    createToggleButtons() {
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'toggle-container';
        
        this.rows.forEach(row => {
            const button = document.createElement('button');
            button.textContent = `Toggle ${row}`;
            button.onclick = () => this.toggleRow(row);
            toggleContainer.appendChild(button);
        });

        this.container.insertBefore(toggleContainer, this.gridContainer);
    }

    toggleRow(row) {
        const rowElement = this.gridContainer.querySelector(`.${row}-row`);
        if (rowElement) {
            rowElement.style.display = rowElement.style.display === 'none' ? '' : 'none';
        }
    }

    messageUpdate() { 
        //const output = this.container;
        //output.innerHTML = "";

        this.gridContainer.innerHTML = '';

        if (!this.message || !this.message.packedData) return;
        
        const message = this.message;

        // old: //function updateOutput(result, inputType, originalInput) {

        //console.log(packedData);
        const packedData = message.packedData;

        const syncCheckResult = message.getSyncCheck();
        const crcCheckResult = message.getCRCCheck();
        const parityCheckResult = message.getParityCheck();

        const symbols = message.symbolsText;
        const bits = symbolsToBitsStr(symbols);
        const packed = packedToHexStrSp(packedData);

        const messageType = message.ft8MessageType; // e.g. "0.0" or "3"
        const messageInfo = getFT8MessageTypeName(messageType); // 

        this.createGrid(symbols, bits, packed);
        this.addAnnotations();
    }

    createGrid(symbols, bits, packed) {
        const totalColumns = symbols.length * 3;  // Each symbol corresponds to 3 bits
        this.gridContainer.style.gridTemplateColumns = `repeat(${totalColumns}, 1fr)`;
        
        this.rows.forEach((rowType) => {
            const rowElement = document.createElement('div');
            rowElement.className = `${rowType}-row`;
            rowElement.style.display = 'contents';

            if (rowType === 'bits') {
                for (let i = 0; i < bits.length; i++) {
                    rowElement.appendChild(this.createBitElement(bits[i], i));
                }
            } else if (rowType === 'symbols') {
                //if (this.message) this.message.readyAudioAndBuffer();
                const audioOptions = this.message?.getOptions();
                const baseFreq = audioOptions?.baseFrequency ?? 0;
                const toneSpacing = audioOptions?.toneSpacing ?? 6.25;                
                //TODO: if bad symbol ('-' or ' ') then no frequency
                const hz = (symbol) => { 
                    return audioOptions?.customToneFrequencies[parseInt(symbol)] 
                        || (baseFreq + toneSpacing * parseInt(symbol)) 
                };
                symbols.split('').forEach((symbol, index) => {
                    rowElement.appendChild(this.createSymbolElement(symbol, index, hz(symbol)));
                });
            } else if (rowType === 'packed') {
                // Add spacer for sync bits
                const spacer = document.createElement('div');
                spacer.style.gridColumn = '1 / 22';
                rowElement.appendChild(spacer);

                packed.split(' ').forEach((byte, index) => {
                    rowElement.appendChild(this.createPackedElement(byte, index));
                });
            }

            this.gridContainer.appendChild(rowElement);
        });
    }

    createBitElement(bit, index) {
        const bitElement = document.createElement('div');
        bitElement.className = `bit ${bit === '1' ? 'bit-one' : 'bit-zero'}`;
        bitElement.textContent = bit;
        bitElement.dataset.index = index;
        bitElement.style.gridColumn = index + 1;
        return bitElement;
    }

    createSymbolElement(symbol, index, hz) {
        const symbolElement = document.createElement('div');
        symbolElement.className = `symbol ${this.isCostasSymbol(index) ? 'costas' : 'data'}`;
        symbolElement.textContent = symbol;
        symbolElement.dataset.index = index;
        symbolElement.style.gridColumn = `${index * 3 + 1} / span 3`;
        symbolElement.title = `${symbol}\n${(hz ? `${hz.toFixed(2)} Hz\n` : '')}Symbol ${index + 1} of ${this.message?.symbols?.length ?? 79}\nGraycode: ${symbolsToGrayBitsStr(symbol)}\nMaps to binary: ${symbolsToBitsStr(symbol)} (=${parseInt(symbolsToBitsStr(symbol),2)})\nStart: ${(index * 0.160).toFixed(2)}s, duration: ${(0.160).toFixed(2)}s`;
        return symbolElement;
    }

    createPackedElement(packedByte, index) {
        let bitspan = (index === 9) ? 5 : 8; // last byte is 5 bits (77 bits total)
        const packedElement = document.createElement('div');
        packedElement.className = 'packed';
        packedElement.textContent = packedByte;
        packedElement.dataset.index = index;
        packedElement.style.gridColumn = `${index * 8 + 22} / span ${bitspan}`;
        return packedElement;
    }

    addAnnotations() {
        const annotationsRow1 = document.createElement('div');
        annotationsRow1.className = 'annotations-row1';
        annotationsRow1.style.display = 'contents';

        const annotationsRow2 = document.createElement('div');
        annotationsRow2.className = 'annotations-row2';
        annotationsRow2.style.display = 'contents';
        
        const annotationsRow3 = document.createElement('div');
        annotationsRow3.className = 'annotations-row3';
        annotationsRow3.style.display = 'contents';

        const annotationsRow4 = document.createElement('div');
        annotationsRow4.className = 'annotations-row4';
        annotationsRow4.style.display = 'contents';

        this.addAnnotation(annotationsRow1, 'sync', null, 0, 21);
        this.addAnnotation(annotationsRow1, 'data', null, 21, 87);
        this.addAnnotation(annotationsRow1, 'sync', null, 108, 21);
        this.addAnnotation(annotationsRow1, 'data', null, 129, 87);
        this.addAnnotation(annotationsRow1, 'sync', null, 216, 21);

        this.addAnnotation(annotationsRow2, 'payload', null, 21, 77);
        this.addAnnotation(annotationsRow2, 'crc', null, 98, 10);
        this.addAnnotation(annotationsRow2, 'crc', null, 129, 4);
        this.addAnnotation(annotationsRow2, 'parity', null, 133, 83);

        const message = this.message;
        const messageType = message.ft8MessageType;
        const payloadBits = symbolsToBitsStr(this.message.symbolsText).slice(21, 108);

        if (annotationDefinitions[messageType]) {
            annotationDefinitions[messageType].forEach(annotation => {
                let value = annotation.getValue(payloadBits) ?? '';
                let shortValue = value;
                if (value.endsWith(' (undecoded value)')) {
                    shortValue = value.split(' ')[0] + "*";
                }

                this.addAnnotation(
                    annotationsRow3, 
                    `${annotation.label}`, 
                    `${annotation.label}`, 
                    21 + annotation.start, 
                    annotation.length
                );
                this.addAnnotation(
                    annotationsRow4, 
                    shortValue, 
                    `${annotation.label}:\n${value}`, 
                    21 + annotation.start, 
                    annotation.length
                );
            });
        } else {
            console.warn(`No annotation definition for message type: ${messageType}`);
        }

        this.gridContainer.appendChild(annotationsRow1);
        this.gridContainer.appendChild(annotationsRow2);
        this.gridContainer.appendChild(annotationsRow3);
        this.gridContainer.appendChild(annotationsRow4);

    }

    addAnnotation(row, label, tooltip, start, len) {
        const annotation = document.createElement('div');
        annotation.className = 'annotation';
        annotation.textContent = label;
        annotation.title = `${tooltip ?? label}\nBits: ${len}`;

        annotation.style.gridColumn = `${start + 1} / span ${len}`;
        row.appendChild(annotation);
    }

    isCostasSymbol(index) {
        const costasIndices = [0, 1, 2, 3, 4, 5, 6, 36, 37, 38, 39, 40, 41, 42, 72, 73, 74, 75, 76, 77, 78];
        return costasIndices.includes(index);
    }

    highlightCurrentSymbol() {
        this.clearHighlights();
        const symbolsRow = this.gridContainer.querySelector('.symbols-row');
        const bitsRow = this.gridContainer.querySelector('.bits-row');
        
        const currentSymbolElement = symbolsRow.children[this.currentSymbol];
        if (currentSymbolElement) {
            currentSymbolElement.classList.add('highlighted');
            for (let i = this.currentSymbol * 3; i < this.currentSymbol * 3 + 3; i++) {
                if (bitsRow.children[i]) bitsRow.children[i].classList.add('highlighted');
            }
        }
    }

    clearHighlights() {
        this.gridContainer.querySelectorAll('.highlighted').forEach(el => el.classList.remove('highlighted'));
    }
        
    onPlay() {
        this.currentSymbol = 0;
        this.highlightCurrentSymbol();

        this.interval = setInterval(() => {
            this.frameUpdate();
        }, 50); // Update every 50ms

    }

    onStop() {
        if (this.interval) clearInterval(this.interval);
        this.clearHighlights();
    }

    frameUpdate() {
        if (this.message && this.message.isPlaying) {
            const timing = this.message.getTiming();
            if (timing && timing.currentSymbolIndex !== this.currentSymbol) {
                this.currentSymbol = timing.currentSymbolIndex;
                this.highlightCurrentSymbol();
            }
        }
    }
        
    initialUpdate() {
    }
}
