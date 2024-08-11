class OutputComponent extends Component {
    create() {
    }
    
    messageUpdate() {
        if (this.message == null) {
            this.container.innerHTML = "";
            return;
        }

        const outputData = this.prepareOutputData();
        this.renderOutput(outputData);
    }

    prepareOutputData() {
        const message = this.message;
        const bitsNoCosta = symbolsToBitsStrNoCosta(message.symbolsText);
        
        return {
            inputText: message.inputText,
            inputType: message.inputType,
            ft8MessageType: message.ft8MessageType,
            messageTypeInfo: getFT8MessageTypeName(message.ft8MessageType),
            decoded: this.prepareDecodedInfo(),
            comment: message.expectedResults?.comment,
            decodedText: message.reDecodedResult.decodedText,
            symbols: message.symbolsText,
            packed: packedToHexStrSp(message.packedData),
            codeword: bitsNoCosta, // 174 bits
            messageBits: bitsNoCosta.slice(0, 77),
            crcBits: bitsNoCosta.slice(77, 91),            
            parityBits: bitsNoCosta.slice(91),
            symbols: message.symbolsText,
            syncCheck: message.getSyncCheck(),
            crcCheck: message.getCRCCheck(),
            parityCheck: message.getParityCheck(),
            checks: this.prepareChecks(),
            explanation: this.message.reDecodedResult.success ? 
                explainFT8Message(this.message.reDecodedResult.decodedText, this.message.ft8MessageType) : 
                null,
            encodeError: message.encodeError_ft8lib,
            tests: this.prepareTests(),
            repaired: message.getParityRepairedCodeword()
        };
    }

    prepareChecks() {
        return [
            { name: "Sync check", ...this.message.getSyncCheck() },
            { name: "CRC check", ...this.message.getCRCCheck() },
            { name: "Parity check", ...this.message.getParityCheck() },
            //this.prepareDecodedInfo()
        ];
    }

    prepareDecodedInfo() {
        const decodeResult = this.message.reDecodedResult;
        const decodeTest1 = { name: "decode", ...decodeResult };
        if (!decodeResult.success) {
            //return { error: true, result: 'error', message: `${decodeResult.errorCode}: ${decodeResult.errorMessage}` };
            return [ decodeTest1 ];
        } else {
            decodeTest1.resultText = 'success';
        }

        const decoded = decodeResult.decodedText;
        const originalInput = this.message.inputText;
        const inputType = this.message.inputType;

        const decodeTest2 = {
            name: 'input match',
            result: 'neutral',
            resultText: 'unchecked',
        };
        
        if (inputType === 'message') {
            decodeTest2.result = 'ok';

            if (normalizeMessage(decoded) !== normalizeMessage(originalInput)) {
                decodeTest2.resultInfo = "Decoded message does not appear to match input.";
                decodeTest2.result = 'error';
                decodeTest2.resultText = 'does not match input';
                if (normalizeMessageAndHashes(originalInput).startsWith(normalizeMessageAndHashes(decoded))) {
                    //todo: only catches if both contain a hash; check if decoded has transformed text into hash
                    //decodeTest2.resultInfo = "Hashes appear different.";
                    decodeTest2.resultText = 'match but unable to check hash data';
                    decodeTest2.result = 'warning';

                } else if (normalizeBracketedFreeText(originalInput).toUpperCase().startsWith(decoded.toUpperCase())) {
                    decodeTest2.resultInfo = "Original message appears to be truncated.";
                    decodeTest2.resultText = 'input truncated';
                    decodeTest2.result = 'error';  // warn for plain text, but error for other messages
                    //decodeTest2.result = 'warning';
                } 
            } else  {
                decodeTest2.resultText = 'ok'
            }
            return [ decodeTest1, decodeTest2 ];

        } else if (inputType === 'free text') {
            decodeTest2.result = 'ok';

            if (decoded.toUpperCase() !== normalizeBracketedFreeText(originalInput).toUpperCase()) {
                decodeTest2.resultInfo = "Decoded message does not appear to match free text input.";
                decodeTest2.resultText = 'does not match input';
                decodeTest2.result = 'error';
                if (normalizeBracketedFreeText(originalInput).toUpperCase().startsWith(decoded.toUpperCase())) {
                    decodeTest2.resultInfo = "Original message has been truncated to fit 13 character limit of free text.";
                    decodeTest2.resultText = 'input truncated';
                    decodeTest2.result = 'warning';
                }
            } else {
                decodeTest2.resultText = 'ok'
            }
            return [ decodeTest1, decodeTest2 ];
        }

        // show neutral test 2?
        //return [ decodeTest1, decodeTest2 ]; 

        // or just decodeTest1 
        return [ decodeTest1 ]; 

    }

    prepareTests() {
        if (!this.message.expectedResults) return null;
        if (this.message.expectedResults.notest) return null;

        const expected = this.message.expectedResults;
        const tests = [];
        let renderedRows = '';

        if (expected.type) {
            const expectedType = expected.type.endsWith('.') ? expected.type.slice(0, -1) : expected.type;
            const match = (expectedType === this.message.ft8MessageType);
            const test = {
                name: "Message type",
                result: expectedType === this.message.ft8MessageType ? 'ok' : 'error',
                resultText: expectedType === this.message.ft8MessageType ? 'Matched test' : 'Did not match test',
                expected: expectedType,
                actual: this.message.ft8MessageType
            };
            tests.push(test);
            if (!match) {
                renderedRows += this.renderRowData(`${test.name} (reference)`, test.expected);
                renderedRows += this.renderRowData(`${test.name} (decoded)`, test.actual);
            }
        }

        const expectedMessage = expected.decoded ?? expected.message;
        if (expectedMessage) {
            const match = (expectedMessage.trim() === this.message.reDecodedResult.decodedText.trim());
            const test = {
                name: "Decoded",
                result: (expected.error ? (match ? 'warning' : 'warning') : (match ? 'ok' : 'error')),
                resultText: (expected.error ? (match ? 'Matched test*' : 'Did not match test*') : (match ? 'Matched test' : 'Did not match test')),
                expected: expectedMessage,
                actual: this.message.reDecodedResult.decodedText,
                note: expected.error ? "Error or truncated result expected" : null
            };
            const hashMatch = (normalizeMessageAndHashes(expectedMessage) === normalizeMessageAndHashes(this.message.reDecodedResult.decodedText));
            if (!match && hashMatch) {
                test.result = 'ok';
                test.resultText = 'Matched test*';
                tests.push(test);
                tests.push({ name: "Note", result: 'warning', resultText: 'ignored hashed callsigns' });
            } else {
                tests.push(test);
            }
            if (expected.error) {
                tests.push({ name: "Note", result: 'warning', resultText: 'Expected (successful) test will have an error or truncated text' });
            }
            
            if (!match) {
                renderedRows += this.renderRowData(`${test.name} (reference)`, test.expected);
                renderedRows += this.renderRowData(`${test.name} (decoded)`, test.actual);
            }
        }

        if (expected.symbols) {
            const expectedSymbols = expected.symbols.replace(/\s/g, '');
            const match = (expectedSymbols === this.message.symbolsText);
            const test = {
                name: "Symbols",
                result: match ? 'ok' : 'error',
                resultText: match ? 'Matched test' : 'Did not match test',
                expected: expectedSymbols,
                actual: this.message.symbolsText
            };
            tests.push(test);
            if (!match) {
                const prettyExpected = symbolsPretty(test.expected);
                const prettyActual = symbolsPretty(test.actual);
                renderedRows += this.renderRowData(`${test.name} (reference)`, prettyExpected);
                //renderedRows += this.renderRowData(`${test.name} (decoded)`, test.actual);
                renderedRows += this.renderRowDataHighlights(`${test.name} (decoded)`, prettyActual, this.getDiffHighlights(prettyExpected, prettyActual), 'Red highlights show symbols which differ from the test reference');

                const expectedBits = symbolsToBitsStrNoCosta(test.expected).slice(0, 77);
                const actualBits = symbolsToBitsStrNoCosta(test.actual).slice(0, 77);
                renderedRows += this.renderRowData(`Message bits (reference)`, expectedBits);
                renderedRows += this.renderRowDataHighlights(`Message bits (decoded)`, actualBits, this.getDiffHighlights(expectedBits, actualBits), 'Red highlights show bits which are flipped compared to the test reference.');

            } 
        }

        return {tests, renderedRows};
    }

    renderOutput(data) {
        const outputBox = document.createElement('div');
        outputBox.className = 'output-box';
        outputBox.innerHTML = `
            <h2>${data.messageTypeInfo} (${data.ft8MessageType})</h2>
            <div class="output-content">
                ${this.renderRowData('Input text', data.inputText, data.comment)}
                ${this.renderRowText('Input type', data.inputType)}

                ${this.renderSubheading('Message Fields')}
                ${this.renderRows(data.messageBits, data.ft8MessageType)}

                ${this.renderSubheading('Encoding')}

                ${this.renderChecks('Checks', data.checks)}
                ${this.renderRowData('Message type', `(${data.ft8MessageType}) ${data.messageTypeInfo}`)}
                ${this.renderRowDataHighlights('Symbols', symbolsPretty(data.symbols), this.getSyncHighlights(data.syncCheck), 'Incorrect sync symbols highlighted in red. Use 3140652.')}
                ${this.renderRowData('Packed', data.packed)}
                ${this.renderRowData('Message (77 bits)', data.messageBits)}
                ${this.renderRowDataHighlights('CRC (14 bits)', data.crcBits, this.getCRCHighlights(data.crcCheck))}
                ${this.renderRowDataHighlights('Parity (83 bits)', data.parityBits, this.getParityHighlights(data.parityCheck), 'If a Low Density Parity Check (LDPC) were generated for the Message and CRC, it would differ in the above highlighted bits.')}
                ${(!data.parityCheck.success) ? this.renderRowDataHighlights('174-bit codeword<br>with LDPC errors', data.codeword, this.getLDPCErrorHighlights(data.parityCheck), 'Given the LPDC data, red highlighted bits are the most likely to be incorrect. Orange highlights are less likely errors. The 174-bits are the combined Message + CRC + LDPC.') : ''}
                ${(!data.parityCheck.success && data.repaired) ? this.renderRowDataHighlights('One-step Repair', data.repaired, data.parityCheck.messageErrors.mostFrequentNumbers, 'Single step error repair using parity check data. May repair the message if there are a small number of errors. Copy this into the input and encode to see the result.', 'corrected') : ''  }
                
                ${this.renderSubheading('Decoding')}
                ${this.renderChecks('Decode check', data.decoded )}
                ${this.renderRowData('Input text', data.inputText )}
                ${this.renderRowData('Decoded text', data.decodedText, data.decodedText.includes('<...>') ? '<...> represents a hashed callsign.' : null)}
                ${!data.decoded[0].success ? this.renderRowData('Decode error', data.decoded[0].errorMessage, "Please check if individual message fields were were decoded.") : ''}

                ${(data.explanation || data.encodeError) ? this.renderSubheading('More info') : ''}
                ${data.explanation ? this.renderRowText('Explanation', data.explanation) : ''}
                ${data.encodeError ? this.renderRowData('Initial error', data.encodeError, 'As a fallback the input was encoded as free text after this initial error.') : ''}

                ${data.tests && data.tests.tests ? this.renderSubheading('Comparison to known reference') : ''}
                ${data.tests && data.tests.tests ? this.renderChecks('Tests', data.tests.tests) : ''}
                ${data.tests && data.tests.renderedRows ? data.tests.renderedRows : ''}

            </div>
        `;
//to only show when not message type:
//${data.inputType !== 'message' ? this.renderRow('Input type', data.inputType) : ''}

//to use other renderer:
//                ${data.tests ? this.renderTests(data.tests) : ''}

// old decode renderer: (now part of checks)
//${this.renderDecodedInfo(data.decoded)}

//unhighlighted:
//${this.renderRowData('Symbols', symbolsPretty(data.symbols))}
//${this.renderRowData('CRC (14 bits)', data.crcBits)}
//${this.renderRowData('LDPC (83 bits)', data.parityBits)}

        this.container.innerHTML = '';
        this.container.appendChild(outputBox);
    }

    renderSubheading(text) {
        return `
            <div class="output-row full-width">
                <h3 class="output-subheading">${text}</h3>
            </div>
        `;
    }

    renderRows(payloadBits, ft8MessageType) {
        let rowContent = '';
        if (annotationDefinitions[ft8MessageType]) {
            annotationDefinitions[ft8MessageType].forEach(annotationDef => {
                let annotation = AnnotationDefGetAnnotation(annotationDef, payloadBits);

                const label = annotation.tag ?? annotation.label ?? annotation.shortLabel;
                //TODO: move tag to own field
                //if (annotation.tag != null && label != annotation.tag) label += ` (${annotation.tag})`;
                const secondaryLabel = (annotation.tag != null) ? annotation.label ?? annotation.shortLabel : null;

                const pos = annotation.bits.length === 1 ?
                      `bit ${annotation.start + 1}`
                    : `bits ${annotation.start + 1} to ${annotation.start + annotation.length} (length: ${annotation.length} bits)`;
                
                const text = annotation.value ?? annotation.long ?? annotation.short;
                const note = `Raw bits (=integer): ${annotation.bits} (=${annotation.rawIntValue})\nPosition in payload: ${pos}`;
        
                //rowContent += this.renderRowData(label, text, note);
                rowContent += this.renderRowDataField( {...annotation, value: text, label, secondaryLabel, comment: 'comment example'} );
            });
        } else {
            console.warn(`No annotation definition for message type: ${ft8MessageType}`);
        }
        return rowContent;
    }

    renderRowData(label, value, comment = null) {
        return `
            <div class="output-row">
                <div class="output-label">${label}</div>
                <div class="output-value output-data">${escapeHTML(value)}</div>
                ${comment ? `<div class="output-comment">${escapeHTML(comment).replace('\n','<br>')}</div>` : ''}
            </div>
        `;
    }
    renderRowDataField(fieldData) {
        const {
            label,
            secondaryLabel,
            tag,
            value,
            desc,
            subtype,
            bits,
            rawIntValue,
            start,
            length,
            comment,
            units
        } = fieldData;
    
        const positionInfo = `bits ${start + 1} to ${start + length} (length: ${length} bits)`;
    
        return `
            <div class="output-row">
                <div class="output-label">${secondaryLabel} ${label ? `<span class="output-sublabel">${label}` : ''}</span></div>
                <div class="output-value"><span class="output-data">${escapeHTML(value)}</span>${ units ? `<span class="output-comment-info"> ${units}</span>` : '' }${ subtype || desc ? `<div class="output-metadata">${subtype}</div>` : ''}${(bits.length >= 2) ? `<div class="output-raw-values">Raw value: ${bits} (=${rawIntValue})</div>` : '' }</div>
                <div class="output-comment">
                        ${escapeHTML(desc).replace('\n','<br>')}
                    </div>
            </div>
        `;

    }
    
    renderRowDataHighlights(label, value, highlightIndices = [], ifHighlightsComment = null, colorOverride = null) {
        let highlightedValue = value;
        //Array.isArray(highlightIndices)
        //highlightIndices instanceof Set

        let hasHighlights = false
        if ( highlightIndices === null || highlightIndices.length === 0 || value === '') {
            // pass

        } else if (typeof highlightIndices === 'object' && highlightIndices.hasOwnProperty('uniqueNumbers')) {
            // todo: pretty print
            // only used for parity bits

            highlightedValue = value.split('').map((char, index) => {
                if (highlightIndices.mostFrequentNumbers.has(index)) {
                    hasHighlights = true;
                    return `<span class="highlighted-error" title="bit ${index + 1} / ${value.length}">${char}</span>`;
                } else if (highlightIndices.uniqueNumbers.has(index)) {
                    hasHighlights = true;
                    return `<span class="highlighted-lesser-error" title="bit ${index + 1} / ${value.length}">${char}</span>`;
                } else {
                    return char;
                }
            }).join('');

        } else {
            // note: don't add more title tooltip with bit position, unless sure it will be accurate for symbol data and pretty printed bits/symbols (with extra spaces)
            highlightedValue = value.split('').map((char, index) => {
                const isHighlighted = Array.isArray(highlightIndices) 
                    ? highlightIndices.includes(index) 
                    : highlightIndices.has(index);
                if (isHighlighted) hasHighlights = true;
                return isHighlighted ? `<span class="${colorOverride ? 'highlighted-' + colorOverride : 'highlighted-error'}">${char}</span>` : char
            }).join('');
        }
        
        return `
            <div class="output-row">
                <div class="output-label">${label}</div>
                <div class="output-value output-data">${highlightedValue}</div>
                ${hasHighlights && ifHighlightsComment ? `<div class="output-comment">${ifHighlightsComment}</div>` : ''}
            </div>
        `;

    }

    renderRowText(label, value) {
        return `
            <div class="output-row plain-text">
                <div class="output-label">${label}</div>
                <div class="output-value">${escapeHTML(value)}</div>
                
            </div>
        `;
    }

    renderChecks(label, checks) {
        const getIcon = (result) => {
            switch (result.toLowerCase()) {
                case 'ok': return '✅';
                case 'error': return  '❌';
                case 'warning': return '⚠';
                case 'neutral': return '✅'; //'➖';
                case 'disabled': return ''; // '⚪';
                default: return '';
            }
        };
    
        const checksHtml = checks.map(check => `
            <span class="check-result check-${check.result.toLowerCase()}">
                <span class="check-icon">${getIcon(check.result)}</span>
                ${check.name}: ${check.resultText ?? check.result}
            </span>
        `).join('');
    
        return `
            <div class="output-row full-width">
                <div class="output-label">${label}</div>
                <div class="output-value checks">
                    ${checksHtml}
                </div>
            </div>
        `;
    }
        
    renderDecodedInfo(decodedInfo) {
        if (decodedInfo.error) {
            return this.renderRowData('Error Decoding', decodedInfo.message);
        }

        let content = `Decoded: ${decodedInfo.decoded}`;
        if (decodedInfo.warning) {
            content += `<br>⚠ Decode warning: ${decodedInfo.warning}`;
        }

        return this.renderRowData('Decoded', content);
    }

    renderTests(tests) {
        //meh, use renderChecks instead
        const testsHtml = tests.map(test => `
            <div>
                ${test.result === "OK" ? "✅" : "❌"} ${test.name}: 
                ${test.result === "OK" ? "OK" : `Expected: "${test.expected}", Actual: "${test.actual}"`}
                ${test.note ? ` (${test.note})` : ''}
            </div>
        `).join('');

        return `
            <div class="output-row full-width">
                <div class="output-label">Tests:</div>
                <div class="output-value output-data">${testsHtml}</div>
            </div>
        `;
    }

    onPlaying() {}
    onStop() {}
    initialUpdate() {}
    frameUpdate() {}

    getDiffHighlights(expected, actual) {
        // generic
        const diff = [];
        const maxLength = Math.max(expected.length, actual.length);
        for (let i = 0; i < maxLength; i++) {
            if (expected[i] !== actual[i]) diff.push(i);
        }
        return diff;
    }

    getSyncHighlights_noPrettyPrint(syncCheck) {
        if (syncCheck.result !== 'error') return [];
        const costasPositions = [0, 36, 72];
        return syncCheck.errors.filter(index => 
            costasPositions.some(pos => index >= pos && index < pos + 7)
        );
    }
    
    getSyncHighlights(syncCheck) {
        //3240652 03224752350406114701746102526 3142652 00751360767311242423320017621 3142652
        if (syncCheck.result !== 'error') return [];
        const costasPositions = [0, 36, 72];
        
        return syncCheck.errors.map(index => {
            let prettyIndex = index;
            if (index >= 72) prettyIndex += 4; 
            else if (index >= 36) prettyIndex += 2; 
            
            return prettyIndex;
        });
    }

    getCRCHighlights(crcCheck) {
        if (crcCheck.result === 'ok') return [];
    
        const crcInMessage = crcCheck.crc;
        const crcExpected = crcCheck.received;
    
        return crcInMessage.split('').map((bit, index) => 
            bit !== crcExpected[index] ? index : null
        ).filter(index => index !== null);

        //highlight all:
        //return Array.from({ length: 14 }, (_, i) => i);
    }
            
    
    getParityHighlights(parityCheck) {
        return parityCheck.result === 'error' ? 
            parityCheck.parityErrors : [];
    }

    getLDPCErrorHighlights(parityCheck) {
        var analysis = parityCheck.messageErrors;

        return parityCheck.result === 'error' ? 
            analysis : [];
    }
}

function escapeHTML(text) {
    if (text == null) return '';
    
    const map = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return text.replace(/[<>&"']/g, function(match) {
        return map[match];
    });
}