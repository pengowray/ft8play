import { Component } from './views.js';
import { symbolsToBitsStrNoCosta, bitsToText, symbolsPretty, inputTypeDescriptions, normalizeMessage, normalizeMessageAndHashes, normalizeBracketedFreeText, getFT8MessageTypeName, escapeHTML }  from './ft8_extra.js';
import * as extra from "./ft8_extra.js";
import { explainFT8Message } from './ft8_explain.js';
import { annotationDefinitions, AnnotationDefGetValueText, AnnotationDefGetAnnotation } from './ft8_anno.js';

const REFERENCE = 'expected';
const DECODED = 'found';

export class OutputComponent extends Component {
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
        if (!message || message.symbolsText == null || message.symbolsText == '') {
            //console.log("nothing to output (OutputComponent)");
            return null;
        }
        const bitsNoCosta = symbolsToBitsStrNoCosta(message.symbolsText);
        
        //move me
        const testType = this.message?.expectedResults?.testType ?? null;
        const isATest = (testType !== null && testType !== '') ? 'yes' : null;
        //const isATest = (testType === 'ft8codeSymbols' || testType === 'ft8codeMsg') ? 'yes' : null;
        //const isADemo = (testType === 'example') ? 'yes' : null;

        return {
            inputText: message.inputText,
            inputType: message.inputType,
            inputTypeDescription: inputTypeDescriptions[message.inputType],
            ft8MessageType: message.ft8MessageType,
            messageTypeInfo: extra.getFT8MessageTypeName(message.ft8MessageType),
            decoded: this.prepareDecodedInfo(),
            comment: message.expectedResults?.comment,
            decodedText: message.bestDecodedResult?.success ? message.bestDecodedResult?.decodedText : '',
            decodedText_ft8lib: message.ft8libDecodedResult?.decodedText,
            decodedText_mshv: message.mshvDecodedResult?.success ? message.mshvDecodedResult?.decodedText : '',
            ft8libDecodedResult: message.ft8libDecodedResult,
            mshvDecodedResult: message.mshvDecodedResult,
            symbols: message.symbolsText,
            packed: extra.packedToHexStrSp(message.packedData),
            veryPacked: extra.packedToHexStr(message.packedData),
            codeword: bitsNoCosta, // 174 bits
            messageBits: message.bits,
            allBits: message.allBits,
            crcBits: bitsNoCosta.slice(77, 91),            
            parityBits: bitsNoCosta.slice(91),
            symbols: message.symbolsText,
            syncCheck: message.getSyncCheck(),
            crcCheck: message.getCRCCheck(),
            parityCheck: message.getParityCheck(),
            checks: this.prepareChecks(),
            explanation: this.message.bestDecodedResult?.success ? 
                explainFT8Message(this.message.bestDecodedResult.decodedText, this.message.ft8MessageType) : 
                null,
            tests: this.prepareTests(),
            repaired: message.getParityRepairedCodeword(),
            testType,
            isATest,
        };
    }

    prepareChecks() {
        if (!this.message || this.packetType != 'ft8') return null;
        return [
            { name: "Sync check", ...this.message.getSyncCheck() },
            { name: "CRC check", ...this.message.getCRCCheck() },
            { name: "Parity check", ...this.message.getParityCheck() },
            //this.prepareDecodedInfo()
        ];
    }

    prepareDecodedInfo() {
        //TODO: try both decoders

        const decodeResult = this.message.bestDecodedResult;
        if (decodeResult == null) {
            return [ { error: true, result: 'error', message: 'No decode result' } ];
        }

        const decodeTest1 = { name: "decode", ...decodeResult };
        if (!decodeResult.success) {
            //return { error: true, result: 'error', message: `${decodeResult.errorCode}: ${decodeResult.errorMessage}` };
            return [ decodeTest1 ];
        }

        decodeTest1.resultText = 'success';
        decodeTest1.result = 'ok';

        const decoded = decodeResult?.decodedText;
        const originalInput = this.message.inputText;
        const inputType = this.message.inputType;

        const decodeTest2 = {
            name: 'input match',
            result: 'neutral',
            resultText: 'unchecked',
        };
        
        if (inputType.startsWith('default')) {
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
                    decodeTest2.resultText = 'truncated'; // 'input truncated';
                    decodeTest2.hideName = true; // no need for "input match: "
                    decodeTest2.result = 'error';  // warn for plain text, but error for other messages
                    //decodeTest2.result = 'warning';
                } 
            } else  {
                decodeTest2.resultText = 'ok'
            }
            return [ decodeTest1, decodeTest2 ];

        } else if (inputType.startsWith('free text')) {
            decodeTest2.result = 'ok';

            if (decoded.toUpperCase() !== normalizeBracketedFreeText(originalInput).toUpperCase()) {
                decodeTest2.resultInfo = "Decoded message does not appear to match free text input.";
                decodeTest2.resultText = 'does not match input';
                decodeTest2.result = 'error';
                if (normalizeBracketedFreeText(originalInput).toUpperCase().startsWith(decoded.toUpperCase())) {
                    decodeTest2.resultInfo = "Original message has been truncated to fit 13 character limit of free text.";
                    decodeTest2.resultText = 'truncated'; //'input truncated';
                    decodeTest2.hideName = true; // no need for "input match: "
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
                renderedRows += this.renderRowData(`${test.name}`, test.expected, null, REFERENCE);
                renderedRows += this.renderRowData(`${test.name}`, test.actual, null, DECODED);
            }
        }

        const expectedMessage = expected.decoded ?? expected.message;
        if (expectedMessage) {
            const match = (expectedMessage.trim() === this.message.bestDecodedResult?.decodedText?.trim() ?? '[fail]');
            const test = {
                name: "Message text",
                result: (expected.error ? (match ? 'warning' : 'warning') : (match ? 'ok' : 'error')),
                resultText: (expected.error ? (match ? 'Matched test*' : 'Did not match test*') : (match ? 'Matched test' : 'Did not match test')),
                expected: expectedMessage,
                actual: this.message.bestDecodedResult?.decodedText,
                note: expected.error ? "Error or truncated result expected" : null
            };
            const hashMatch = (normalizeMessageAndHashes(expectedMessage) === normalizeMessageAndHashes(this.message.bestDecodedResult?.decodedText ?? '[fail]'));
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
                renderedRows += this.renderRowData(`${test.name}`, test.expected, null, REFERENCE);
                renderedRows += this.renderRowData(`${test.name}`, test.actual, null, DECODED);
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
                renderedRows += this.renderRowData(`${test.name}`, prettyExpected, null, REFERENCE);
                renderedRows += this.renderRowDataHighlights(`${test.name}`, prettyActual, this.getDiffHighlights(prettyExpected, prettyActual), 'Red highlights show symbols which differ from the test reference', null, DECODED);

                const expectedBits = symbolsToBitsStrNoCosta(test.expected).slice(0, 77);
                const actualBits = symbolsToBitsStrNoCosta(test.actual).slice(0, 77);
                renderedRows += this.renderRowData(`Message bits`, expectedBits, null, REFERENCE);
                renderedRows += this.renderRowDataHighlights(`Message bits`, actualBits, this.getDiffHighlights(expectedBits, actualBits), 'Red highlights show bits which are flipped compared to the test reference.', null, DECODED);

            } 
        }

        return {tests, renderedRows};
    }

    renderOutput(data) {
        if (data == null) {
            this.container.innerHTML = '';
            return;
        }

        const outputBox = document.createElement('div');
        outputBox.className = 'output-box';
        outputBox.innerHTML = `
            <h2>${data.messageTypeInfo} (${data.ft8MessageType})</h2>
            <div class="output-content">
                ${this.renderRowData('Input text', data.inputText, data.comment)}
                ${this.renderRowDataField( { label: 'Input type', value: data.inputType, subtype: data.inputTypeDescription, isField: false })}
                ${data.isATest ? this.renderRowDataField( { label: 'Test case?', value: data.isATest, subtype: data.testType, isField: false }) : ''}

                ${this.renderSubheading('Message Fields')}
                ${this.renderRows(this.message.allBits ?? this.message.bits, data.ft8MessageType)}

                ${this.renderSubheading('FT8 Packing')}

                ${this.renderChecks('Checks', data.checks)}
                ${this.renderRowDataHighlights('Symbols', extra.symbolsPretty(data.symbols), this.getSyncHighlights(data.syncCheck), 'Incorrect sync symbols highlighted in red. Expected sync symbols: 3140652.', null, '79 tones')}
                ${this.renderRowData('Message', data.packed, `Without spaces: ${data.veryPacked}. Zero-extended to 10 bytes.`, 'packed')}
                ${this.renderRowData('Message', data.messageBits, null, `${data.messageBits.length} bits`)}
                ${this.renderRowDataHighlights('Checksum', data.crcBits, this.getCRCHighlights(data.crcCheck), null, 'CRC failed', '14 bits', 'CRC (cyclic redundancy check)')}
                ${this.renderRowDataHighlights('Parity', data.parityBits, this.getParityHighlights(data.parityCheck), 'Low Density Parity Check (LDPC). The highlighted bits differ from parity data which would match the combined message and CRC bits.', null, '83 bits', 'Low Density Parity Check (LDPC)')}
                ${(!data.parityCheck.success) ? this.renderRowDataHighlights('Codeword', data.codeword, this.getLDPCErrorHighlights(data.parityCheck), 'Red highlighted bits are the most likely to be incorrect, considering the parity data. Orange highlighted bits are less likely errors. The 174 bits are the message, CRC, and LDPC concatenated together.', null, '174-bit', 'The 174 bits are the concatenation of the message, CRC, and LDPC.') : ''}
                ${(!data.parityCheck.success && data.repaired) ? this.renderRowDataHighlights('One-step Repair', data.repaired, data.parityCheck.messageErrors.mostFrequentNumbers, 'This has changes applied to the codeword, applying a single-step error repair, based on the parity data. Copy this into the input and encode to see the result. If there are only a small number of errors, this may repair the message.', 'corrected', '*') : ''  }
                
                ${this.renderSubheading('FT8 Unpacking')}
                ${this.renderChecks('Decode check', data.decoded )}
                ${this.renderRowData('Input text', data.inputText )}
                
                ${data.mshvDecodedResult.success ? 
                    this.renderRowDataField({label: 'Decoded text', secondaryLabel: 'mshv', value: data.decodedText_mshv}) :
                    this.renderRowDataField({label: 'Decode error', secondaryLabel: 'mshv', value: data.mshvDecodedResult.errorMessage, isField: false})}
                ${data.ft8libDecodedResult.success ? 
                    this.renderRowDataField({label: 'Decoded text', secondaryLabel: 'ft8_lib', value: data.decodedText_ft8lib, desc: data.decodedText_mshv.includes('<...>') || data.decodedText_ft8lib.includes('<...>') ? '<...> represents a hashed callsign.' : null }) :
                    this.renderRowDataField({label: 'Decode error', secondaryLabel: 'ft8_lib', value: data.ft8libDecodedResult.errorMessage, isField: false})}

                ${data.explanation ? this.renderSubheading('More info') : ''}
                ${data.explanation ? this.renderRowText('Explanation', data.explanation) : ''}

                ${data.tests && data.tests.tests ? this.renderSubheading('Comparison to known reference') : ''}
                ${data.tests && data.tests.tests ? this.renderChecks('Tests', data.tests.tests) : ''}
                ${data.tests && data.tests.renderedRows ? data.tests.renderedRows : ''}

            </div>
        `;

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

                const label = (annotation.tag != null) ? annotation.label ?? annotation.shortLabel : null;
                const secondaryLabel = annotation.tag ?? annotation.label ?? annotation.shortLabel;

                const pos = annotation.bits.length === 1 ?
                      `bit ${annotation.start + 1}`
                    : `bits ${annotation.start + 1} to ${annotation.start + annotation.length} (length: ${annotation.length} bits)`;
                
                const text = annotation.value ?? annotation.long ?? annotation.short;
                const note = `Raw bits (=integer): ${annotation.bits} (=${annotation.rawIntValue})\nPosition in payload: ${pos}`;
        
                //rowContent += this.renderRowData(label, text, note);
                rowContent += this.renderRowDataField( {...annotation, value: text, label, secondaryLabel} );
            });
        } else {
            console.warn(`No annotation definition for message type: ${ft8MessageType}`);
        }
        return rowContent;
    }

    renderRowData(label, value, comment = null, secondaryLabel = null) {
        return `
            <div class="output-row">
                <div class="output-label">${label} ${secondaryLabel ? `<span class="output-sublabel">${secondaryLabel}` : ''}</span></div>
                <div class="output-value output-data">${escapeHTML(value)}</div>
                ${comment ? `<div class="output-comment">${escapeHTML(comment).replace('\n','<br>')}</div>` : ''}
            </div>
        `;
    }
    renderRowDataField(fieldData) {
        let {
            label,
            secondaryLabel,
            tag,
            value,
            desc,
            descNoEsc,
            subtype,
            bits,
            rawIntValue,
            start,
            length,
            comment,
            units,
            callsign,
            hashBits,
            hashLen,
            isHash, // focus on hash not call
            operatingStatusIndicator, // e.g. /R or /P indicated elsewehre
            country,
            rawAppend,
            isField = true, // Field within the data. If rendering something else e.g "Input type", set to false (for smaller font), or lie and say true to make something else big like "Decoded text"
            isFlag,
            on,
            off,

        } = fieldData;
    
        //todo:
        //const positionInfo = `bits ${start + 1} to ${start + length} (length: ${length} bits)`;

        const zhash = (hashBits && hashBits.length > 0) ? extra.hashBitsPrettyZ32(hashBits) : null;
        const hashIntStr = (hashBits && hashBits.length == 22) ? extra.hashBitsTo22styleBase10(hashBits) : null;

        //todo: less hackish escapeHTML toggle
        let valueText = '';
        if (callsign || zhash) {
            //const boldifyCall = true; // !isHash; // turn off hash highlighting for now
            valueText = `${ callsign ? `<span class="output-call gravity-high"><span class="${ !isHash ? 'call-highlighter':''}">${escapeHTML(callsign)}</span>${operatingStatusIndicator ?? ''} </span>` : '' }<span class="output-hash ${ isHash ? 'gravity-medium':'gravity-low'}" ${(hashIntStr && hashIntStr != 0) ? `title="${hashIntStr}"` : ''}>${extra.addUnderlineToHash(hashBits, isHash ? hashLen : 0)}</span>`
            if (country) { valueText += `<div class="output-country gravity-low">${escapeHTML(country)}</div>`; }
        } else {
            if (isFlag) { 
                valueText = `${this.makeSwitch(bits === '1', off, on)}`;

            } else if ((bits == '0' || bits == '1') && units == null) { // not a switch if you set units; bit of a hack
                //valueText = `<span class="output-data>${this.makeSwitch(bits === '1', '0', '1')}</span>`;
                valueText = `${this.makeSwitch(bits === '1', '0', '1')}`;
            } else {
                valueText = `<span class="output-data ${isField ? 'output-field' : ''}">${escapeHTML(value)}</span>`;
            }
        }

        return `
            <div class="output-row">
                <div class="output-label">${label}${secondaryLabel ? ` <span class="output-sublabel">${secondaryLabel}` : ''}</span></div>` 
                + `<div class="output-value">${valueText}${ units ? `<span class="output-comment-info"> ${units}</span>` : '' }`
                + `${ subtype ? `<div class="output-metadata">${subtype}</div>` : ''}` 
                + `${(bits && (bits.length >= 2 || rawAppend != null)) ? `<div class="output-raw-values">Raw value: ${bits} (=${rawIntValue})${rawAppend ? ` ${rawAppend}` : ''}</div>` : '' }`  +
               `</div>`
                + `${desc ? `<div class="output-comment">${escapeHTML(desc).replace('\n','<br>')}</div>` : ''}` 
                + `${descNoEsc ? `<div class="output-comment">${descNoEsc}</div>` : ''}
           </div>
        `;
    }
    
    renderRowDataHighlights(label, value, highlightIndices = [], ifHighlightsComment = null, colorOverride = null, secondaryLabel = null, noHighlightComment = null) {
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
                <div class="output-label">${label} ${secondaryLabel ? `<span class="output-sublabel">${secondaryLabel}` : ''}</span></div>
                <div class="output-value output-data">${highlightedValue}</div>
                ${hasHighlights && ifHighlightsComment ? `<div class="output-comment">${ifHighlightsComment}</div>` : ''}
                ${!hasHighlights && noHighlightComment ? `<div class="output-comment">${noHighlightComment}</div>` : ''}
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
        if (checks == null) {
            //console.log('no checks', checks);
            return '';
        }

        const checksHtml = checks.map(check => `
            <span class="check-result check-${check.result.toLowerCase()}">
                <span class="check-icon">${getIcon(check.result)}</span>
                ${check.hideName ? '' : `${check.name}: `}${check.resultText ?? check.result}
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
        //const costasPositions = [0, 36, 72];
        
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

    makeSwitch(isOn, OffLabel = '0', OnLabel = '1', isDisabled = true) {
        return `
            <div class="toggle-switch toggle-switch${isDisabled ? '--disabled' : ''}">
                <span class="toggle-switch__label ${!isOn ? 'gravity-high' : 'gravity-low'}">${OffLabel}</span>
                <label class="toggle-switch__track">
                    <input type="checkbox" class="toggle-switch__input" ${isOn ? 'checked' : ''} disabled>
                    <span class="toggle-switch__slider"></span>
                </label>
                <span class="toggle-switch__label ${isOn ? 'gravity-high' : 'gravity-low'}">${OnLabel}</span>
            </div>
        `;
    }
}

//export default OutputComponent;