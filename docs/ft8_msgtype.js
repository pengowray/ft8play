/**
 * Extracts the FT8 message type from packed message data.
 * 
 * This function interprets the last 6 bits of a 77-bit FT8 message payload:
 * - Bits 74-76 (i3) determine the primary message type (0-7)
 * - For type 0, bits 71-73 (n3) determine the subtype (0.0 - 0.7)
 * 
 * The function returns the type as a string:
 * - "0.0" to "0.7" for type 0 messages
 * - "1" to "7" for other types
 * - "-" for invalid or insufficient input data
 * 
 * @param {Uint8Array} packedData - The packed 77-bit message payload (10 bytes)
 * @returns {string} The extracted message type
 */
export function getFT8MessageTypeFromPacked(packedData) {
    if (!packedData || packedData.length < 10) {
        return "-";
    }
    
    const i3 = (packedData[9] >> 3) & 0x07;
    
    if (i3 === 0) {
         // n3: bit[72] to bit[74] of end-padded 77-bit payload
        const n3 = ((packedData[9] >> 6) & 0x03) | ((packedData[8] << 2) & 0x04);
        return `0.${n3}`;
    }
    
    return i3.toString();
}

export function getFT8MessageType(bits) {
    const i3 = parseInt(bits.slice(74, 77), 2);
    if (i3 === 0) {
        const n3 = parseInt(bits.slice(71, 74), 2);
        const type = `0.${n3}`;
        if (type === "0.6") {
            if (bits[49] == '1') { // j50 
                return "wspr2"; // '--1'
            } else if (bits[48] == '0') { // j49 'x00'
                return "wspr1"; // '-00'
            } else if (bits[47] == '0') { // j48
                return "wspr3"; // '010'
            }
        }
        return type;
    }
    return i3.toString();
}


export function getFT8MessageTypeName(type) {
    switch (type) {
        case "0.0": return "Free text";
        case "0.1": return "DXpedition mode";
        case "0.2": return "Unknown / Reserved";
        case "0.3": return "Field Day";
        case "0.4": return "Field Day";
        case "0.5": return "Telemetry";
        case "0.6": return "WSPR";
        case "0.7": return "Unknown / Reserved";
        case "1": return "Standard message";
        case "2": return "EU VHF";
        case "3": return "ARRL RTTY Roundup";
        case "4": return "Non-standard callsign";
        case "5": return "EU VHF with 6-digit grid locator";
        case "6": return "Unknown / Reserved";
        case "7": return "Unknown / Reserved";
        case "spp": return "Space Packet Protocol";
        case "wspr1": return "WSPR 1";
        case "wspr2": return "WSPR 2";
        case "wspr3": return "WSPR 3";
        default: return "Unknown";
    }
}


export const inputTypeDescriptions = {
    '77 bits': 'Payload data',
    '80 bits': 'Payload data, extended with three zero bits',
    '82 bits': 'Payload data, extended with five zero bits', // input to CRC calculations, according to FT4_FT8_QEX.pdf paper
    '91 bits': 'Payload + CRC',
    '174 bits': 'Payload + CRC + LDPC',
    '237 bits': 'All symbols mapped to regular binary tribbles',
    '237 grits': 'All symbols as their graycode triplets',
    '58 symbols': 'FSK tone data without sync tones',
    '79 symbols': 'Full FSK tone data',
    'packed': 'Payload as hexadecimal (zero-extended)', // aka right padded with 0's
    'default': 'FT8 message text',
    // 'default/<encoder>' descriptions are in ft8_engines.js
};
