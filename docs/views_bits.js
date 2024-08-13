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

        const annotationsRow5 = document.createElement('div');
        annotationsRow5.className = 'annotations-row5';
        annotationsRow5.style.display = 'contents';
        let requireAnnotationsRow5 = false;

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
        const ft8MessageType = message.ft8MessageType;
        const payloadBits = symbolsToBitsStr(this.message.symbolsText).slice(21, 108);

        const defs = annotationDefinitions[ft8MessageType];
        if (defs) {
            defs.forEach(annotationDef => {
                let annotation = AnnotationDefGetAnnotation(annotationDef, payloadBits);

                const anno3_text = annotation.shortLabel ?? annotation.label ?? annotation.tag;
                const anno3_tooltip = `${annotation.label ?? annotation.shortLabel ?? annotation.tag}\n${annotation.tag}\nPosition in payload: ${annotation.start + 1} to ${annotation.start + annotation.length} bits`;
                
                this.addAnnotation(annotationsRow3, anno3_text, anno3_tooltip, 21 + annotation.start, annotation.length);

                const anno4_text = annotation.short ?? annotation.value ?? annotation.long;
                const anno4_tooltip = `${annotation.label ?? annotation.shortLabel ?? annotation.tag}\n${annotation.long ?? annotation.value ?? annotation.short}\nRaw bits (=integer): ${annotation.bits} (=${annotation.rawIntValue})`;
        
                this.addAnnotation(annotationsRow4, anno4_text, anno4_tooltip, 21 + annotation.start, annotation.length);
                
                // subdefinitons: used only for telemetry bytes right now
                if (annotation.subdefs) {
                    requireAnnotationsRow5 = true;
                    annotation.subdefs.forEach(subdef => {
                        const subanno = AnnotationDefGetAnnotation(subdef, payloadBits);
                        const subanno_text = subanno.short ?? subanno.value ?? subanno.long;
                        const subanno_tooltip = `${subanno.label ?? subanno.shortLabel ?? subanno.tag}\n${subanno.long ?? subanno.value ?? subanno.short}\nRaw bits (=integer): ${subanno.bits} (=${subanno.rawIntValue})`;
                        console.log(subanno);
                        this.addAnnotation(annotationsRow5, subanno_text, subanno_tooltip, 21 + subanno.start, subanno.length);
                    });
                }
            });
            
        } else {
            console.warn(`No annotation definition for message type: ${ft8MessageType}`);
        }

        this.gridContainer.appendChild(annotationsRow1);
        this.gridContainer.appendChild(annotationsRow2);
        this.gridContainer.appendChild(annotationsRow3);
        this.gridContainer.appendChild(annotationsRow4);
        if (requireAnnotationsRow5) this.gridContainer.appendChild(annotationsRow5);

    }

    addAnnotation(row, label, tooltip, start, len) {
        const annotation = document.createElement('div');
        annotation.className = 'annotation';
        annotation.textContent = label;
        annotation.title = `${tooltip ?? label}\nLength: ${len} bits`;

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
