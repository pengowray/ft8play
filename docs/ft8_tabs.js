import { FT8Message } from './ft8_msg.js';
import { grayBitsToSymbols, encodeFT8FreeText, packedDataTo80Bits, getFT8MessageType, normalizeMessage, normalizeMessageAndHashes, normalizeBracketedFreeText, checkSync, checkCRC, checkParity, repairErrorsOnce, symbolsToBitsStrNoCosta  } from "./ft8_extra.js";
import * as extra from "./ft8_extra.js";
import * as hashmgr from "./ft8_hashmgr.js";

/*
// format: 'ft8/77b', 'ft8/text',  ...
// generic formats: 'bits', 'text', 'symbols', 'ft8/bits', 'ft8/text', 'ft8/symbols'
// engine: 'ft8_lib', 'mshv', 'ft8play'
// engineVersion: example: 'MSHV 245'
// error: means error creating ft8_msg; NOT error validating msg, but that should also be indicated on the tab
// todo: processing (flags): 'rpad', 'ucase', 'normalize' (e.g. removed spaces), 'flip bits', 'grits', 'truncate text', 'remove zero padding' ...
//      'hash(es) not expanded'
// todo: assumptions (interpretation): 'hash1 match' (assumed not a collision), 'is ft8',
// todo: { meh: true } less interesting tabs, e.g. grits or flip bits when more basic results are available or when not valid result; hide behind a "more..." button
// todo: future formats: [X] wspr in ft8, [ ] wspr, [ ] js8, [ ] hash, [X] spp
*/

export function globalInputNormalization(input) {
    //TODO: any input types we shouldn't normalize in all the ways?

    // 'Größe Straße' -> 'GROSSE STRASSE'
    // '“Café ① ² × ³ Olé”' -> '"CAFE 1 2 X 3 OLE"'

    const specialCharMapping = {
        'Ø': '0', // Slashed zero
        '×': 'X',
        '—': '-', // Em dash
        '–': '-', // En dash
        "“": '"', '”': '"', '„': '"', '‘': "'", '’': "'", 
        '…': '...'
      };

    return input.trim()
        .normalize('NFKD')
        .replace(/\p{Mark}/gu, '') // remove diacritics
        .toUpperCase()
        .replace(/\s+/g, ' ') // double spaces
        .replace(/[Ø×—–“”„‘`’…]/g, match => specialCharMapping[match] || match);
}


function initMessage(message, normalizedInput, inputType) { // was: encode()
    const input = normalizedInput;
    
    switch (inputType) {
        case 'free':
        case 'free text':
        case 'free text L':
        case 'free text R':
            const freetextBits = extra.encodeFT8FreeText(input);
            message.initBits(freetextBits);
            return;
        case '79 symbols':
            message.initSymbolsText(input);
            return;
        case '58 symbols':
            const symbolsText = extra.symbols58ToSymbols79(input);
            message.initSymbolsText(symbolsText);
            return;
        case 'packed':
            const packed = extra.hexToPacked(input);
            message.initPackedData(packed);
            return;
        case 'packed spp':
            const packedSpp = extra.hexToPacked(input);
            message.packetType = 'spp';
            message.ft8MessageType = 'spp';
            message.initPackedData(packedSpp);
            message.allBits = packedDataTo80Bits(packedSpp);
            //message.ft8MessageType = 'spp'; 
            return;
        case 'telemetry':
            let result = extra.encodeFT8Telemetry(input);
            if (result.error) {
                //this.encodeError = result.error;
                throw new Error(result.error);
                return;
            }
            //this.packedData = new Uint8Array(result.result.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            message.initPackedData(extra.hexToPacked(result.result));
            return;
        case '77 bits':
            //this.packedData = extra.bitsToPacked(input);
            message.initBits(input);
            return;
        case '80 bits':
        case '82 bits':
            const zeroPadding = bitStr.slice(77);
            if (zeroPadding != '000' && zeroPadding != '00000') {
                throw new Error(`Invalid ${inputType} message: not zero extended. Expected 77 bits + 3 or 5 zeros; Found: ${bitStr.slice(0,77)} ${zeroPadding}`);
            }
            message.initBits(bitStr.slice(0, 77));
            return;
        case '91 bits':
            message.initSymbolsText(extra.binary91ToSymbols(input));
            return;
        case '174 bits':
            message.initSymbolsText(extra.binary174ToSymbols(input));
            return;
        case '237 bits': // symbols (as normal binary, including sync)
            message.initSymbolsText(extra.binary237ToSymbols(input));
            return;
        case '237 grits': // symbols (as graycode bits, including sync)
            message.initSymbolsText(extra.grayBitsToSymbols(input));
            return;
        case 'default/mshv':
            message.initMessage(input, 'mshv');
            /*
            const mshvPackingResult = mshvft8.packMessage(input);
            if (mshvPackingResult.errorCode !== 0) {
                throw new Error(`MSHV encoding failed; Code ${mshvPackingResult.errorCode}): ${mshvPackingResult.message}`);
            } else if (mshvPackingResult.message == null || mshvPackingResult.message == '') {
                throw new Error(`MSHV encoding failed; No message returned`);
            }
            message.initBits(mshvPackingResult.message);
            */
            return;
        case 'default/ft8lib':
            message.initMessage(input, 'ft8lib');
            //const packingResult = ft8lib.messageToPackedData(input);
            //if (packingResult.errorCode !== 0) throw new Error(`lib_ft8 encoding failed; Code ${packingResult.errorCode}): ${packingResult.errorMessage}`);
            //message.initPackedData(packingResult.data);
            return;
        default:
            throw new Error(`Unhandled input type: ${inputType}`);
    }
}

/////////////////////////////////

export function detectTelemetry(str) {
    //exactly 18 hex digits, or start with T:
    //note: first digit must be 0-8 if 18 digits. (not checked here)
    //todo: also consider 0x prefix, h suffix, (for this and packed hex)
    const trimmed = str.trim().toUpperCase();
    return (/^([0-9A-Fa-f][\s\-\:\,]?){18}$/.test(trimmed)) 
          || (/^[T](ELEMETRY)?\s*:/.test(trimmed))
          || (/\#T(ELEMETRY)?$/.test(trimmed));
}

export function detectPossibleTelemetry(str) {
    //hex digits, near proper length but less than packed data length
    //note: bits (0,1) and symbols (0-7) are valid hex too
    const trimmed = str.trim().toUpperCase();
    return (/^([0-9A-Fa-f][\s\-\:\,]?){1,19}$/.test(trimmed));
}

function detectFreeTextBrackets(str) {
    // brackets or quotes
    const trimmed = str.trim();
    return (trimmed.startsWith('<') && trimmed.endsWith('>') && !trimmed.slice(1, trimmed.length-1).includes('<'))  
        || (trimmed.startsWith('"') && trimmed.endsWith('"'));
}

function normalizeSymbols(input) {
    // numbers only
    return input.replace(/[-\s]/g, '');
}

function normalizeBinary(input) {
    // 0 and 1 only
    return input.replace(/[-\s]/g, '');
}

function normalizePackedData(input) {
    //return input.replace(/[-\s]/g, '').toUpperCase();
    return input.replace(/[\s\-\:\,]/g, '').toLowerCase();
}

function normalizeTelemetry(str) {
    //exactly 18 hex digits, or start with T:
    //note: first digit must be 0-8 if 18 digits. (not checked here)
    
    let trimmed = str.trim();
    trimmed = trimmed.toUpperCase()
        .replace(/^[T](ELEMETRY)?:\s*/g, '') // remove initial "T:" or telemetry:
        .replace(/\#T(ELEMETRY)?\s*$/g, '') // remove "#TELEMETRY "
        .replace(/[-\s\:\,]/g, '') // remove any space - : ,
        .replace(/^[0]*/g, ''); // initial 0's
    return trimmed;
}

export function inputToTabs(inputOriginal, expectedResults = null) {
    
    const input = globalInputNormalization(inputOriginal);

    hashmgr.addHashesFromInput(input); //note: will be ignored if only numbers
    if (expectedResults) {
        if (expectedResults?.decoded) hashmgr.addHashesFromInput(expectedResults.decoded);
        if (expectedResults?.message) hashmgr.addHashesFromInput(expectedResults.message);
    }

    const tabs = [];
    const info = {};

    if (input != inputOriginal) info.normalized = true;

    const inputTypes = detectInputTypes(input, inputOriginal);

    // grits check
    // TODO: put this somewhere else
    if ('237 bits' in inputTypes) {
        const normBinary = normalizeBinary(input);
        //const normBinary = '010001110000101100011';
        const grayCosta    = '011001100000110101010';
        if (normBinary.startsWith(grayCosta) || normBinary.endsWith(grayCosta) || normBinary.slice(108, 129) == grayCosta) {
            inputTypes['237 grits'] = 20;
        }
    }

    // print input types
    console.log('Input types:', inputTypes);

    // Sort inputTypes by weight (high to low)
    const sortedTypes = Object.entries(inputTypes)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

    console.log('Sorted Input types:', sortedTypes);

    for (const type of sortedTypes) {
        if (inputTypes[type] > 0) {
            //const weight = inputTypes[type];
            const tab = { input: input, inputType: type };

            console.log("start tab: ", type);

            let message = null;
            try {
                const normalizedInput = normalizeType(input, type);
                console.log(" - normalizedInput: ", normalizedInput);

                message = new FT8Message(input)
                console.log(" - message: ", message);

                message.inputType = type;
                message.normalizedInput = normalizedInput;
                message.expectedResults = expectedResults;
                console.log(" - init type: ", type);
                initMessage(message, normalizedInput, type);

                tabs.push(message);

            } catch (error) {
                if (message !== null) {
                    message.encodeError = error.message;
                    console.log(`Error encoding message (type:${type}, input:"${input}"): ${error.message}`);
                    console.trace(error);
                    //show error somewhere even if failed
                    tabs.push(message);
                } else {
                    console.log(`Null error encoding message [no tab to push] (type:${type}, input:"${input}"): ${error.message}`);
                    console.trace(error);
                }
            }
        }
    }

    if (expectedResults && expectedResults.symbols && expectedResults.symbols.length >= 79) {
        const expectedSymbols = expectedResults.symbols;
        const normalizedSymbols = normalizeType(expectedSymbols, '79 symbols');
        let expectedMsg = new FT8Message(expectedSymbols, expectedResults);
        expectedMsg.normalizedInput = normalizedSymbols;
        expectedMsg.initSymbolsText(normalizedSymbols);
        expectedMsg.inputType = 'expected';
        expectedMsg.bestDecodedResultFromExpected(expectedResults);
        tabs.push(expectedMsg);
    }

    tabs.forEach(message => {
        message.tabs = tabs;
    });

    return tabs;
}

export function normalizeType(input, type) {
    // note: input is already had globalInputNormalization()
    switch (type) {
        case 'free':
        case 'free text':
            return normalizeBracketedFreeText(input);
        case 'free text L':
            return extra.normalizeFreeTextL(input);
        case 'free text R':
            return extra.normalizeFreeTextR(input);
        case '79 symbols':
        case '58 symbols':
            return normalizeSymbols(input);
        case 'packed':
        case 'packed spp':
            return normalizePackedData(input);
        case 'telemetry':
            return normalizeTelemetry(input);
        case '77 bits':
        case '80 bits':
        case '82 bits':
        case '91 bits':
        case '174 bits':
        case '237 bits':
        case '237 grits':
            return normalizeBinary(input);
        case 'default':
        case 'default/mshv':
        case 'default/ft8lib':
        case 'default/ft8play':
            return extra.normalizeMessage(input);
        default:
            return input;
    }
}

// was: detectInput / doDetectInputType
export function detectInputTypes(normalizedInput, inputOriginal) {
    const input = normalizedInput;

    //TODO: return normalized forms per type?
    //TODO: check for "protcol" in input, e.g. "ft8/msg:" etc

    const inputTypes = {}; // { 'type': weight, 'type2': weight, ... }
    
    if (detectFreeTextBrackets(input)) {
        // free text has brackets or quotes
        inputTypes['free text'] = 30; // generally the same as 'free text R' -- unless it contains invalid characters, or if normalizeFreeTextR() tidies it up some other way to be different
        inputTypes['free text L'] = 4; // generally the same as mshv's free text encoding
        inputTypes['free text R'] = 3;

    } else {
         // fallback free text
        inputTypes['free text'] = 5;
        inputTypes['free text L'] = 4;
        inputTypes['free text R'] = 3;
    }

    // ordinary message (todo: checks?)
    inputTypes['default/mshv'] = 9; 
    //inputTypes['default/ft8play'] = 8; // TODO
    inputTypes['default/ft8lib'] = 7;

    if (/^[0-7]{79}$/.test(normalizeSymbols(input))) {
        //TODO: warn if all 0 or 1
        inputTypes['79 symbols'] = 25;
    }

    if (/^[0-7]{58}$/.test(normalizeSymbols(input))) {
        inputTypes['58 symbols'] = 25;
    }

    // Check if input is hex string (packed data); pairs of hex must be together.
    if (/^\s*([0-9A-Fa-f]{2}[-\s\,\:]?){10}\s*$/.test(input)) {
        inputTypes['packed'] = 25;

        if (inputOriginal.includes(',')) {
            inputTypes['packed spp'] = 50;
        }
    }

    if (detectTelemetry(input)) {
        inputTypes['telemetry'] = 30;
    } else if (detectPossibleTelemetry(input)) {
        // only hex digits, length < 20
        inputTypes['telemetry'] = 6; // before only fallback free text
    }

    const normBinary = normalizeBinary(input);
    if (/^[0-1]+$/.test(normBinary)) {
        const len = normBinary.length;
        if ([77, 80, 82, 91, 174, 237].includes(len)) {
            inputTypes[`${len} bits`] = 20; // '77 bits' to '237 bits'
        }  else {
            //todo: add 'Unrecognized binary length' type or show the warning somewhere
            console.log(`Unrecognized binary string length: ${len} bits`);
        }
    }

    return inputTypes;
}