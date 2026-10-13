import { COSTAS_STR, GRAY_MAP, GRAY_INV } from './ft8_constants.js';

export function symbolsToBitsStr(symbols) {
    return symbols.split('').map(s => GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

export function symbolsToBitsStrPreserveSpaces(symbols) {
    return symbols.split('').map(s => (s === ' ') ? ' ' : GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

export function symbolsToGrayBitsStr(symbols) {
    return symbols.split('').map(s => parseInt(s).toString(2).padStart(3, '0')).join('');
}

export function symbolsToBitsStrNoCosta(symbols) {
   if (symbols.length !== 79) throw new Error("Invalid symbols count");
   var symbolsWithoutCostas = symbols.slice(7, 36) + symbols.slice(43, 72);
   //return symbolsToBitsStr(symbolsWithoutCostas);
   return symbolsWithoutCostas.split('').map(s => GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

export function bitsToSymbols(binaryString) {
    let symbols = "";
    
    if (binaryString.length % 3 !== 0) throw new Error("Bad input to bitsToSymbols");

    for (let i = 0; i < binaryString.length; i += 3) {
        const bits = binaryString.slice(i, i + 3);
        const decimal = parseInt(bits, 2);
        symbols += GRAY_MAP[decimal].toString();
    }
    return symbols;
}


export function grayBitsToSymbols(graybits) {
    if (graybits.length % 3 !== 0) throw new Error("Bad input to grayBitsToSymbols");

    return graybits.match(/.{3}/g).map(b => parseInt(b, 2)).join('');
}

export function binary237ToSymbols(binaryString) {
    return bitsToSymbols(binaryString);
}

export function binary174ToSymbols(binaryString) {
    const sync = "3140652";
    //return sync.concat(bitsToSymbols(binaryString.slice(0, 29*3)).concat(sync).concat(bitsToSymbols( binaryString.slice(29*3, 58*3))).concat(sync);
    return `${sync}${bitsToSymbols(binaryString.slice(0, 29*3))}${sync}${bitsToSymbols(binaryString.slice(29*3, 58*3))}${sync}`;
}

export function debugPrintMessageDetails(symbols) {
    if (!symbols || symbols.length === 0) {
        console.log("No symbols to print.");
        return;
    }
    if (!symbols.match(/^[0-7]*$/)) {
        console.log("Symbols contain invalid characters: ", symbols);
        return;
    }
    
    let bitString = symbolsToBitsStrNoCosta(symbols);

    if (symbols && symbols.length == 79) {
        console.log("Source-encoded message, 77 bits:\n"
         + bitString.slice(0, 77) + "\n\n"

         + "14-bit CRC: \n" 
         + bitString.slice(77, 91) + "\n\n"

         + "83 Parity bits\n"
         + bitString.slice(91)  + "\n\n"

         + "Channel symbols (79 tones):\n"
         + "  Sync               Data               Sync               Data               Sync\n"
         + symbolsPretty(symbols) + "\n\n");

         //console.log(symbols.slice(0, 7));
         console.log('graycode:', symbolsToGrayBitsStr(symbols));

    } else if (symbols && symbols.length > 0) {
        console.log(`Symbols (not 79): '${symbols}'`);
    }
}

export function symbolsPretty(symbols) {
    return `${symbols.slice(0, 7)} ${symbols.slice(7, 36)} ${symbols.slice(36, 43)} ${symbols.slice(43, 72)} ${symbols.slice(72)}`
}

export function symbolsToPrettyBinary(symbols) {
    return symbolsToBitsStrPreserveSpaces(symbolsPretty(symbols));
}

export function symbols58ToSymbols79(symbols) {
    // adds missing costas
    if (symbols.length !== 58) {
        throw new Error("Invalid length (expected 58)");
    }
    return COSTAS_STR + symbols.slice(0, 29) + COSTAS_STR + symbols.slice(29, 58) + COSTAS_STR;
}

export function packedToHexStr(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function packedToHexStrSp(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
}

export function packedDataTo80Bits(packedData) {
    if (packedData.length !== 10) {
        throw new Error("Invalid packed data: must be a Uint8Array of length 10");
    }
    return Array.from(packedData).map(b => b.toString(2).padStart(8, '0')).join('');
}

export function bitsToHexForTelemetry(binaryStr) {
    // Pad the binary string to ensure its length is a multiple of 4
    // not sure if it should be start or end?
    binaryStr = binaryStr.padEnd(Math.ceil(binaryStr.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < binaryStr.length; i += 4) {
        let fourBits = binaryStr.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }
    
    return hexString;
}

export function bitsToHex(binaryStr) {
    // Pad the binary string to ensure its length is a multiple of 4
    binaryStr = binaryStr.padStart(Math.ceil(binaryStr.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < binaryStr.length; i += 4) {
        let fourBits = binaryStr.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }
    
    return hexString;
}

export function bitsToPacked(bitString) {
    if (bitString.length != 80 && bitString.length != 77) {
        throw new Error("Invalid length to pack: must be 77 or 80 bits");
    }

    const bits = bitString.replace(/[-\s]/g, '').padEnd(80, '0');
    return Uint8Array.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
}

export function hexToPacked(hexString) { 
    if (hexString.length != 20) {
        throw new Error("Invalid length to pack: must be 10 bytes (20 hex characters)");
    }

    return Uint8Array.from(hexString.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    //return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

export function arrayToSymbols(toneArray) {
  // Convert the Uint8Array to a regular array of numbers
  const numbers = Array.from(toneArray);
  
  // Convert numbers back to string characters
  const tones = numbers.map(num => num.toString());
  
  // Join the array into a single string
  return tones.join('');
}

export function symbolsToArray(toneString) {
  // Remove any whitespace and split the string into an array of characters
  const tones = toneString.replace(/\s/g, '').split('');
  
  // Convert characters to numbers and filter out any NaN values
  const arrayTones = tones.map(tone => parseInt(tone, 10))
                          .filter(num => !isNaN(num));
  
  return new Uint8Array(arrayTones);
}

export function symbolsToPackedData(symbolsText) {
  // returns Uint8Array

  const messageBits = symbolsToBitsStrNoCosta(symbolsText).slice(0, 77).padEnd(80, '0');
  const packedData = new Uint8Array(10);
  
  for (let i = 0; i < 10; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      if (i * 8 + j < messageBits.length) {
        byte |= (messageBits[i * 8 + j] === '1' ? 1 : 0) << (7 - j);
      }
    }
    packedData[i] = byte;
  }
  // debug:
  //console.log('symbolsText, messageBits, packedData', symbolsText, messageBits, packedData);

  return packedData;
}


export function binaryToInt(binary) {
    return parseInt(binary, 2);
}

export function bitsToBigIntString(binaryString) {
    // convert bit string to an integer display.
    // works for long strings.

    const MAX_SAFE_LENGTH = 52; // JavaScript's max safe integer is 2^53 - 1
    
    if (binaryString.length <= MAX_SAFE_LENGTH) {
        return parseInt(binaryString, 2).toString();
    }

    let decimal = '0';
    const binaryLength = binaryString.length;

    for (let i = 0; i < binaryLength; i++) {
        if (binaryString[i] === '1') {
            // Calculate 2^(binaryLength - 1 - i)
            let power = '1';
            for (let j = 0; j < binaryLength - 1 - i; j++) {
                power = addStrings(power, power);
            }
            decimal = addStrings(decimal, power);
        }
    }

    return decimal;
}

function addStrings(num1, num2) {
    let i = num1.length - 1;
    let j = num2.length - 1;
    let carry = 0;
    let result = '';

    while (i >= 0 || j >= 0 || carry > 0) {
        const digit1 = i >= 0 ? parseInt(num1[i]) : 0;
        const digit2 = j >= 0 ? parseInt(num2[j]) : 0;
        const sum = digit1 + digit2 + carry;
        result = (sum % 10) + result;
        carry = Math.floor(sum / 10);
        i--;
        j--;
    }

    return result;
}
