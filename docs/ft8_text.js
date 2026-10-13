import { FT8_CHAR_TABLE_FULL } from './ft8_constants.js';
import { bitsToHexForTelemetry } from './ft8_convert.js';

// not used / tested
function decodeFT8FreeTextPayload(payload) {
    if (!(payload instanceof Uint8Array) || payload.length !== 10) {
        throw new Error("Invalid payload: must be a Uint8Array of length 10");
    }

    // Extract the 71 bits of free text data
    let n71 = BigInt(0);
    for (let i = 0; i < 9; i++) {
        n71 = (n71 << BigInt(8)) | BigInt(payload[i]);
    }

    // Decode the text
    let text = "";
    for (let i = 0; i < 13; i++) {
        let index = Number(n71 % BigInt(42));
        text = FT8_CHAR_TABLE_FULL[index] + text;
        n71 = n71 / BigInt(42);
    }

    // Trim trailing spaces
    text = text.trimEnd();

    return text;
}

// Convert 71 bits of free text to a string
export function bitsToText(bits) {
    if (bits.length !== 71) throw new Error("Free text must be 71 bits");
    
    let text = "";
    let n = BigInt("0b" + bits);
    const charTable = FT8_CHAR_TABLE_FULL;
    
    for (let i = 0; i < 13; i++) {
        let charIndex = Number(n % 42n);
        text = charTable[charIndex] + text;
        n = n / 42n;
    }
    
    return text.trim();
}


// Example usage
//const payload = new Uint8Array([0x17, 0x6C, 0x5D, 0xB8, 0x73, 0x7F, 0x8A, 0x49, 0x30, 0x00]);
//console.log(decodeFT8FreeText(payload));
export function encodeFT8FreeText(message) {
  const MAX_LEN = 13;
  // Ensure the message is no longer than 13 characters
  message = message.slice(0, MAX_LEN).toUpperCase();
  
  // Pad the message to 13 characters with spaces
  message = message.padStart(MAX_LEN, ' ');

  // Initialize the result as a BigInt
  let result = 0n;
  
  // Encode each character
  for (let i = 0; i < MAX_LEN; i++) {
    const charIndex = FT8_CHAR_TABLE_FULL.indexOf(message[i]);
    if (charIndex === -1) {
      throw new Error(`Invalid character for free text: ${message[i]}`);
    }
    result = result * 42n + BigInt(charIndex);
  }
  
  // Convert to 71-bit binary string
  let binaryString = result.toString(2).padStart(71, '0');


  // message type 0.0 (6 bits)
  binaryString += '000000';

  return binaryString;

  /*
  message type 0.0 (6 bits) + 3 bits padding to get to 80
  binaryString = binaryString + '000000000';

  // Convert binary string to Uint8Array
  const output = new Uint8Array(10);
  for (let i = 0; i < 10; i++) {
    output[i] = parseInt(binaryString.slice(i * 8, (i + 1) * 8), 2);
  }
  return output;
  */

}

// Encode hex to 71-bits of telemetry data in a 77-bit payload
export function encodeFT8Telemetry(telemetryHex) {
  
  //if (!/^[0-9A-Fa-f]{1,18}$/.test(telemetryHex)) {
  if (!/^[0-9A-Fa-f]*$/.test(telemetryHex)) {
    return { "error": `Invalid character(s) found in telemetry data. Must contain only hex values (0 to F).` };
  } else if (telemetryHex.length > 18 || telemetryHex.length < 1) {
    return { "error": `Telemetry data must be a 1 to 18 hex character string. Found ${telemetryHex.length} hex characters. (May exclude leading zeros)` };
  }

  let binaryString = hexToBinary(telemetryHex); // leading 0's are trimmed

  // Check if the binary string starts with 1 (exceeding 71 bits)
  if (binaryString.length > 71) { // || binaryString[0] == '1'
    return { "error": "First digit of 18-character hex string telemetry data must fall in the range 0 to 7." };
  }

  binaryString = binaryString.padStart(71, '0') + '101000' // message type 0.5

  // Convert binary string back to hex string
  return { "result": bitsToHexForTelemetry(binaryString, true) };
}

// Decode 71-bit telemetry data (untested; done by ft8_lib already)
export function decodeFT8Telemetry(payload) {
  if (!(payload instanceof Uint8Array) || payload.length !== 10) {
    throw new Error("Invalid payload: must be a Uint8Array of length 10");
  }

  // Extract the binary string
  let binaryString = '';
  for (let i = 0; i < 10; i++) {
    binaryString += payload[i].toString(2).padStart(8, '0');
  }

  // Remove the last 6 bits (message type)
  binaryString = binaryString.slice(0, -6);

  // Convert binary to hex
  const telemetryHex = bitsToHexForTelemetry(binaryString);

  return telemetryHex;
}

export function telemetryBitsToText(bits) {
    if (bits.length !== 71) throw new Error("Telemetry must be 71 bits");

    // pad the start
    bits = bits.padStart(Math.ceil(bits.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < bits.length; i += 4) {
        let fourBits = bits.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }

    return hexString;
}

export function telemetryBitsToByteText(bits) {
    bits = bits.padStart(Math.ceil(bits.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < bits.length; i += 4) {
        let fourBits = bits.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }

    hexString.padStart(2, '0');
    return hexString;
}

export function telemetryByteAnnotations() {
    const skipOnFirst = 1;
    const totalLen = 71;
    let annotations = [];
    let n = 0;
    let len = 7; // skip first bit

    for (let i = 0; i < totalLen; i += len) {
        if (n==1) len = 8;
        annotations.push( { label: `byte[${n}]`, start: i, length: len, getValue: telemetryBitsToByteText} );
        n++;
    }

    return annotations;
}


// Helper function to convert hex string to binary string
function hexToBinary(hex) {
  return hex.split('').map(char => 
    parseInt(char, 16).toString(2).padStart(4, '0')
  ).join('').replace(/^0*/g, '');
}

export function normalizeMessage(message) {
    return message.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function normalizeMessageAndHashes(message) {
    // replace contents of <...> with '<...>'
    return message.trim().toUpperCase().replace(/\s+/g, ' ').replace(/<[^>]*>/g, '<...>');
}

export function normalizeFreeTextL(input, len = 13) {
    let norm = cleanFreetext(input);
    if (norm.length > len) norm = norm.slice(0, len);
    return norm.padEnd(len, ' ');
}

export function normalizeFreeTextR(input, len = 13) {
    let norm = cleanFreetext(input);
    if (norm.length > len) norm = norm.slice(-len);
    return norm.padStart(len, ' ');
}

export function cleanFreetext(input) {
    // remove chars not in FT8_CHAR_TABLE_FULL and replace with space
    var replaced = input.replace(/[^ 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+\-./?]/g, ' ');
    // remove double spaces and trim
    return replaced.replace(/\s+/g, ' ').trim();
}

export function normalizeBracketedFreeText(input) {
    // trim and remove brackets or quotes
    if (input.startsWith('<') && input.endsWith('>')) {
        return input.trim().replace(/^<|>$/g, '');
    } else if (input.startsWith('"') && input.endsWith('"')) {
        return input.trim().replace(/^"|"$|“|”/g, '');
    }
    return input.trim();
}
