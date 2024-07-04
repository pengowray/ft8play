// Constants
const FT8_CHAR_TABLE_FULL = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?";

// not used / tested
function decodeFT8FreeText(payload) {
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

// Example usage
//const payload = new Uint8Array([0x17, 0x6C, 0x5D, 0xB8, 0x73, 0x7F, 0x8A, 0x49, 0x30, 0x00]);
//console.log(decodeFT8FreeText(payload));

function encodeFT8FreeText(message) {
  const MAX_LEN = 13;
  // Ensure the message is no longer than 13 characters
  message = message.slice(0, MAX_LEN).toUpperCase();
  
  // Pad the message to 13 characters with spaces
  message = message.padStart(MAX_LEN, ' ');
  
  // Define the character set
  const chars = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?";
  
  // Initialize the result as a BigInt
  let result = 0n;
  
  // Encode each character
  for (let i = 0; i < MAX_LEN; i++) {
    const charIndex = chars.indexOf(message[i]);
    result = result * 42n + BigInt(charIndex);
  }
  
  // Convert to 71-bit binary string
  let binaryString = result.toString(2).padStart(71, '0');

  // message type 0.0 (6 bits) + 3 bits padding to get to 80
  binaryString = binaryString + '000000000';

  // Convert binary string to Uint8Array
  const output = new Uint8Array(10);
  for (let i = 0; i < 10; i++) {
    output[i] = parseInt(binaryString.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return output;
}

// Encode 71-bit telemetry data
function encodeFT8Telemetry(telemetryHex) {
  // Ensure the input is a valid 18-character hex string
  if (!/^[0-9A-Fa-f]{1,18}$/.test(telemetryHex)) {
    return { "error": "Error: Telemetry data must be a 1 to 18 character hex string" };
  }

  // Convert hex to binary string
  let binaryString = hexToBinary(telemetryHex).replace(/^0*/g, '');

  // Add message type 0.5 (000101 in binary)
  binaryString = binaryString.padStart(71, '0') + '101000' // slice(-71)

  // Check if the binary string starts with 1 (exceeding 71 bits)
  if (binaryString[0] === '1' || binaryString.length > 77) {
    return { "error": "Error: First digit of 18-character hex string telemetry data must fall in the range 0 to 7." };
  }

  //console.log('telemetry', binaryString);
  // Convert binary string back to hex string
  return { "result": binaryToHex(binaryString) };
}

// Decode 71-bit telemetry data (untested; done by ft8_lib already)
function decodeFT8Telemetry(payload) {
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
  const telemetryHex = binaryToHex(binaryString);

  return telemetryHex;
}


function packedToHexStr(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function packedToHexStrSp(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
}

function binaryToHex(binaryStr) {
    // Pad the binary string to ensure its length is a multiple of 4
    let paddedBinaryStr = binaryStr.padEnd(Math.ceil(binaryStr.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < paddedBinaryStr.length; i += 4) {
        let fourBits = paddedBinaryStr.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }
    
    return hexString;
}


// Helper function to convert hex string to binary string
function hexToBinary(hex) {
  return hex.split('').map(char => 
    parseInt(char, 16).toString(2).padStart(4, '0')
  ).join('');
}

// Helper function to convert binary string to hex string
function binaryToHex_V2(binary) {
  return binary.match(/.{1,8}/g).map(byte => 
    parseInt(byte, 2).toString(16).padStart(2, '0')
  ).join('');
}

