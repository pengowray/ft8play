// Log panel: completed QSOs, newest first. Kept only until the page is closed or reloaded.

import { utcTime } from '../band_activity.js';
import { $ } from './dom.js';

export class LogPanel {
    /**
     * @param {{time: number, dxCall: string, dxGrid?: string, sentReport?: string, rcvdReport?: string}} c
     * @param {string} frequency the dial frequency, or why there isn't one
     */
    add(c, frequency) {
        const tr = document.createElement('tr');
        for (const v of [utcTime(c.time), c.dxCall, c.dxGrid ?? '', c.sentReport ?? '', c.rcvdReport ?? '', frequency]) {
            const td = document.createElement('td');
            td.textContent = v;
            tr.appendChild(td);
        }
        $('log-rows').prepend(tr);
        $('log-empty').hidden = true;
    }
}
