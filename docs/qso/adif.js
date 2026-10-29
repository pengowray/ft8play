// ADIF (Amateur Data Interchange Format) export of logged QSOs, as an .adi text file that
// logging programs, LoTW, QRZ and Club Log import. No DOM.
// Spec: https://adif.org/314/ADIF_314.htm

import { adifBand } from './bands.js';

const ADIF_VERSION = '3.1.4';
const PROGRAM_ID = 'FT8Play';

/** One field, <NAME:length>value; empty for a missing value. */
function field(name, value) {
    if (value == null || value === '') return '';
    const v = String(value);
    return `<${name}:${v.length}>${v} `;
}

const pad = (n, width = 2) => String(n).padStart(width, '0');
const adifDate = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const adifTime = (d) => `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;

/**
 * @param {{startTime?: number, endTime: number, dxCall: string, dxGrid?: string, sentReport?: string,
 *          rcvdReport?: string, myCall?: string, myGrid?: string, dialHz?: number|null,
 *          txFreqHz?: number, mode?: string}} q
 */
export function adifRecord(q) {
    const start = new Date(q.startTime ?? q.endTime);
    const end = new Date(q.endTime);
    // FREQ is the transmit frequency, dial + audio offset, in MHz (as WSJT-X writes it).
    const rfHz = q.dialHz ? q.dialHz + (q.txFreqHz ?? 0) : null;
    return [
        field('CALL', q.dxCall),
        field('GRIDSQUARE', q.dxGrid),
        field('MODE', q.mode ?? 'FT8'),
        field('RST_SENT', q.sentReport),
        field('RST_RCVD', q.rcvdReport),
        field('QSO_DATE', adifDate(start)),
        field('TIME_ON', adifTime(start)),
        field('QSO_DATE_OFF', adifDate(end)),
        field('TIME_OFF', adifTime(end)),
        field('BAND', adifBand(rfHz ?? q.dialHz)),
        field('FREQ', rfHz ? (rfHz / 1e6).toFixed(6) : null),
        field('STATION_CALLSIGN', q.myCall),
        field('MY_GRIDSQUARE', q.myGrid),
    ].join('') + '<EOR>';
}

/** A whole .adi file: header, then one record per line. */
export function toAdif(qsos, { now = Date.now() } = {}) {
    const created = new Date(now);
    const header = `FT8 QSO log exported from ft8play.pengowray.com/qso/\n`
        + field('ADIF_VER', ADIF_VERSION) + field('PROGRAMID', PROGRAM_ID)
        + field('CREATED_TIMESTAMP', `${adifDate(created)} ${adifTime(created)}`) + '<EOH>\n';
    return header + qsos.map(adifRecord).join('\n') + '\n';
}
