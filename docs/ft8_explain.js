
export function explainFT8Message(text, msgType) {
    if (text === "Decoding failed") {
        return '';
    }

    //todo: take better advantage of message format, not just the text

    let typeExplanation = ""; //TODO?

    const parts = text.trim().split(/\s+/);
    let explanation = '';
    //console.log(parts); // [ "K1ABC", "W9XYZ", "RRR" ]

    function isSimpleCallsign(call) {
        return /^[A-Z0-9]{1,6}$/.test(call);
    }
    function isValidCallsign(call) {
        // at least one letter, one number, 3 to 15 characters, optional slash but not as first or last character
        return /[A-Z]/.test(call) && /[0-9]/.test(call) && /^[A-Z0-9][A-Z0-9\/]{1,13}[A-Z0-9]$/.test(call);
    }

    function isGridLocator(grid) {
        return /^[A-R]{2}[0-9]{2}([a-x]{2})?$/.test(grid);
    }

    function isReport(report) {
        return /^[+-]?\d{2}$/.test(report);
    }

    if (parts.length === 2 && parts[0] === 'CQ') {
        if (isValidCallsign(parts[1])) {
            explanation = `This is a general call (CQ) message. Station ${parts[1]} is calling CQ, looking for any station to respond.`;
        } else {
            explanation = `This is an unrecognized CQ message.`;
        }
    } else if (parts.length === 3 && parts[0] === 'CQ') {
        if (isValidCallsign(parts[1]) && isGridLocator(parts[2])) {
            explanation = `This is a general call (CQ) message with location. Station ${parts[1]} is calling CQ from grid square ${parts[2]}, looking for any station to respond.`;
        } else if (/^[A-Z]{2}$/.test(parts[1]) && isValidCallsign(parts[2])) {
            explanation = `This is a directed CQ message. Station ${parts[2]} is calling CQ, specifically looking for stations in the ${parts[1]} region to respond.`;
        } else {
            explanation = `This is an unrecognized CQ message.`;
        }
    } else if (parts.length === 3 && isValidCallsign(parts[0]) && isValidCallsign(parts[1])) {
        const receiver = parts[0];
        const sender = parts[1];
        const report = parts[2];
        if (isReport(report) && report !== '73') {
            explanation = `Station ${sender} is sending a signal report of ${report} dB to station ${receiver}.`;
            if (parts[2] === '73') { 
                explanation += ' 73 is also shorthand for "best regards".'
            }
        } else if (parts[2] === 'RRR') {
            explanation = `Station ${sender} is confirming receipt of information from station ${receiver}.`;
        } else if (parts[2] === 'RR73') {
            explanation = `Station ${sender} is confirming receipt and saying "best regards" (goodbye) to station ${receiver}.`;
        } else if (parts[2] === '73') {
            explanation = `Station ${sender} is saying goodbye to station ${receiver} with "73" (best regards).`;
        } else if (isGridLocator(parts[2])) {
            explanation = `Station ${sender} is sending its grid locator ${report} to station ${receiver}.`;
        } else if (parts[2].startsWith('R')) {
            explanation = `Station ${sender} is acknowledging receipt of a message from ${receiver} and sending a signal report of ${report.slice(1)} dB.`;
        } else {
            explanation = `This is a message from ${sender} to ${receiver}, but the content "${report}" is not recognized.`;
        }
    } else if (parts.length === 4 && isValidCallsign(parts[0]) && isValidCallsign(parts[1])) {
        const receiver = parts[0];
        const sender = parts[1];

        if (parts[2] === 'R' && isReport(parts[3])) {
            explanation = `This is a signal report acknowledgment. Station ${sender} is confirming receipt of a previous message and sending a signal report of ${parts[3]} dB to station ${receiver}.`;
        } else {
            explanation = `This is a message from ${sender} to ${receiver}, but the content "${parts[2]} ${parts[3]}" is not recognized.`;
        }
    } else if (msgType === '0.0') { // || message.startsWith('<') && message.endsWith('>')) {
        explanation = `This is a free-text message: "${text}".`;
        if (text.length == 13) {
            explanation += ' The message is the maximum length of 13 characters.';
        }
    } else if (msgType === '0.5') {
        const digits = text.replace(/^0*/g, '');
        if (digits.length > 0) {
            explanation = `This is a telemetry message containing hexadecimal digits: ${text.replace(/^0*/g, '')}. The specific meaning depends on the implementation.`;
        } else {
            explanation = `This is a telemetry message. The data is all zeros.`;
        }
        
    } else if (/^[0-9A-F]{4,18}$/.test(text) && /[A-F]/.test(text)) { // all hex digits with at least one A-F 
        explanation = `This message is made up of hexadecimal digits, but it is not of the telemetry message type.`;
    } else {
        explanation = '';
        //explanation = `This appears to be a custom or non-standard message: "${message}". It doesn't match common FT8 message formats.`;
    }

    return typeExplanation + explanation;
}