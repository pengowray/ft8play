import { COSTAS_STR, kFTX_LDPC_generator, LDPC_MATRIX, LDPC_NUM_ROWS } from './ft8_constants.js';
import { symbolsToBitsStrNoCosta, binary174ToSymbols } from './ft8_convert.js';

export function binary91ToSymbols(binaryString) { // 77 bits + CRC
    //const bits174 = binaryString.padEnd(174, '0')
    //const symbolsNoLDPC = binary174ToSymbols(bits174); 

    const ldpc = calculateParity(binaryString);

    //return binary174ToSymbols(binaryString + ldpc);
    return binary174ToSymbols(ldpc.fullCodeword);

}

export function checkSync(symbols) {
    if (symbols.length !== 79) {
        throw new Error("Input must be 79 characters (symbols) long");
    }
    const syncPositions = [0, 36, 72];
    let errors = [];
    
    for (let i = 0; i < syncPositions.length; i++) {
        const syncPos = syncPositions[i];
        for (let j = 0; j < COSTAS_STR.length; j++) {
            if (symbols[syncPos + j] !== COSTAS_STR[j]) {
                errors.push(syncPos + j);
            }
        }
    }
    
    if (errors.length !== 0) {
        //TODO: js8
        //TODO: deeper dive
        const js8oldIcos7a = "4256130"; // js8call old Beginning, Middle, End Costas 7x7 tone pattern
        const js8newIcos7a = "0623541"; // Beginning Costas 7x7 tone pattern
        const js8newIcos7b = "1502364"; // Middle Costas 7x7 tone pattern
        const js8newIcos7c = "2506413"; // End Costas 7x7 tone pattern
    }

    return {
        result: errors.length === 0 ? 'ok' : 'error',
        errors: errors // list of bad symbols
    };
}

export function ftx_compute_crc(message, num_bits) {
    const FT8_CRC_WIDTH = 14;
    const FT8_CRC_POLYNOMIAL = 0x2757;  // 14-bit CRC polynomial without the leading 1
    const TOPBIT = 1 << (FT8_CRC_WIDTH - 1);

    let remainder = 0;
    let idx_byte = 0;

    // Perform modulo-2 division, a bit at a time.
    for (let idx_bit = 0; idx_bit < num_bits; ++idx_bit) {
        if (idx_bit % 8 === 0) {
            // Bring the next byte into the remainder.
            remainder ^= (message[idx_byte] << (FT8_CRC_WIDTH - 8));
            ++idx_byte;
        }

        // Try to divide the current data bit.
        if (remainder & TOPBIT) {
            remainder = (remainder << 1) ^ FT8_CRC_POLYNOMIAL;
        } else {
            remainder = (remainder << 1);
        }
    }

    return remainder & ((TOPBIT << 1) - 1);
}

export function checkCRC(symbols) {
    let bitString = symbolsToBitsStrNoCosta(symbols);
    let msgBits = bitString.slice(0, 77).padEnd(82, '0').split('').map(Number);
    
    // Convert bit array to byte array
    let messageBytes = [];
    for (let i = 0; i < 82; i += 8) {
        messageBytes.push(parseInt(msgBits.slice(i, i + 8).join(''), 2));
    }
    
    let calculatedCRC = ftx_compute_crc(messageBytes, 82);
    let receivedCRC = parseInt(bitString.slice(77, 91), 2);

    return {
        crc: calculatedCRC.toString(2).padStart(14, '0'),
        received: receivedCRC.toString(2).padStart(14, '0'),
        result: calculatedCRC === receivedCRC ? 'ok' : 'error'
    };
}

export function checkParity(symbols) {
    let bits = symbolsToBitsStrNoCosta(symbols).slice(0, 174).split('').map(Number);  // We need all 174 bits
    
    let failedParityBits = new Set();
    let failedMessageBits = []; // can contain duplicates

    // Check parity equations
    for (let i = 0; i < LDPC_MATRIX.length; i++) {
        let sum = 0;
        for (let j = 0; j < LDPC_NUM_ROWS[i]; j++) {
            let bitIndex = LDPC_MATRIX[i][j] - 1;  // Adjust for 0-based indexing
            if (bitIndex >= 0 && bitIndex < 174) {
                //sum ^= bits[bitIndex] === '0' ? 0 : 1;
                sum ^= bits[bitIndex];
            }
        }
        if (sum !== 0) {
            failedParityBits.add(i);
            for (let j = 0; j < LDPC_NUM_ROWS[i]; j++) {
                let bitIndex = LDPC_MATRIX[i][j] - 1;
                //if (bitIndex >= 0 && bitIndex < 91) {  // Only include message bits
                    failedMessageBits.push(bitIndex);
                //}
            }
        }
    }

    return {
        result: failedParityBits.size === 0 ? 'ok' : 'error',
        success: failedParityBits.size === 0,
        failedParityCount: failedParityBits.size,
        failedMessageCount: failedMessageBits.size,
        parityErrors: failedParityBits,
        messageErrors: (failedMessageBits.length > 0) ? analyzeNumbers(failedMessageBits) : null, // { frequencyMap, uniqueNumbers, mostFrequentNumbers }
    };
}

export function calculateParity(binaryString) {
    if (binaryString.length !== 91) {
        throw new Error("Input must be 91 bits long (77 message bits + 14 CRC bits)");
    }

    let messageBits = binaryString.split('').map(Number);
    let parityBits = new Array(83).fill(0);

    // Convert message bits to bytes
    let messageBytes = [];
    for (let i = 0; i < 91; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < 91; j++) {
            byte |= messageBits[i + j] << (7 - j);
        }
        messageBytes.push(byte);
    }

    // Calculate parity bits using generator matrix
    for (let i = 0; i < 83; i++) {
        for (let j = 0; j < 12; j++) {
            let generatorByte = kFTX_LDPC_generator[i][j];
            for (let k = 0; k < 8; k++) {
                if (j * 8 + k < 91) {
                    parityBits[i] ^= ((generatorByte >> (7 - k)) & 1) & messageBits[j * 8 + k];
                }
            }
        }
    }

    // Combine message bits and parity bits
    let fullCodeword = messageBits.concat(parityBits);

    return {
        parityBits: parityBits.join(''),
        fullCodeword: fullCodeword.join('')
    };
}

//TODO: roll this into calculateParity
export function analyzeNumbers(numbers) {
    // Count occurrences of each number
    const frequencyMap = new Map();
    for (const num of numbers) {
      frequencyMap.set(num, (frequencyMap.get(num) || 0) + 1);
    }
  
    // Find the maximum frequency
    const maxFrequency = Math.max(...frequencyMap.values());
  
    // Create sets
    const uniqueNumbers = new Set(numbers);
    const mostFrequentNumbers = new Set(
      [...frequencyMap.entries()]
        .filter(([_, frequency]) => frequency === maxFrequency)
        .map(([number, _]) => number)
    );
  
    return {
      frequencyMap,
      uniqueNumbers,
      mostFrequentNumbers
    };
}

export function repairErrorsOnce(codewordBits, parityCheck) {
    // naively repair codeword by flipping the most frequent error bits in the LDPC parity check
    // does not check if repair leads to parity check passing
    
    if (parityCheck.success) return null; // codewordBits; // nothing to repair
    const flip = parityCheck.messageErrors.mostFrequentNumbers;
    const flipped = codewordBits.split('').map((element, index) => { 
        if (flip.has(index)) return element === '0' ? '1' : '0';
        return element;
    }).join('');
    return flipped;
}
