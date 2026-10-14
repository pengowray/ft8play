// Log panel: completed QSOs, newest first. Kept only until the page is closed or reloaded.

import { utcTime } from '../band_activity.js';
import { $, formatMHz } from './dom.js';

export class LogPanel {
    /**
     * @param {{time: number, dxCall: string, dxGrid?: string, sentReport?: string, rcvdReport?: string}} c
     * @param {number|null} dialHz the radio's (or RTL-SDR's) dial frequency, if known
     */
    add(c, dialHz) {
        const tr = document.createElement('tr');
        for (const v of [utcTime(c.time), c.dxCall, c.dxGrid ?? '', c.sentReport ?? '', c.rcvdReport ?? '', dialHz ? formatMHz(dialHz) : '']) {
            const td = document.createElement('td');
            td.textContent = v;
            tr.appendChild(td);
        }
        $('log-rows').prepend(tr);
        $('log-empty').hidden = true;
    }
}
