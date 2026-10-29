// Log panel: completed QSOs, newest first, with ADIF download and Delete log. The QSOs
// themselves are kept by LogBook (saved in this browser; test-mode QSOs only until reload).

import { bandName } from '../bands.js';
import { $, formatMHz } from './dom.js';

const qsos = (n) => `${n} ${n === 1 ? 'QSO' : 'QSOs'}`;
const TEXT = {
    count: (saved, test) => `${qsos(saved)} saved${test ? ` · ${test} test ${test === 1 ? 'QSO' : 'QSOs'}` : ''}`,
    testRow: 'Test mode',
    noDial: 'Unknown',
    noDialTitle: 'This QSO has no band or frequency in the ADIF file. To record the band and frequency of later QSOs, choose the radio\'s frequency from the Dial frequency list in the Audio input section, or connect Radio control (CAT).',
    confirmDelete: (n) => `${n === 1 ? 'Delete 1 saved QSO' : `Delete all ${n} saved QSOs`} from this browser? This cannot be undone. To keep a copy, click Cancel and use Download ADIF first.`,
    saveError: (reason) => `The log could not be saved in this browser (${reason}). Download ADIF before you close or reload the page, to keep a copy of your QSOs.`,
};

const pad = (n) => String(n).padStart(2, '0');
/** e.g. ["2026-10-29", "07:12"] (UTC). */
function utcDateTime(ms) {
    const d = new Date(ms);
    return [`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`];
}

/** A cell made of parts that a narrow screen may put on separate lines, e.g. date and time. */
function partsCell(parts) {
    const td = document.createElement('td');
    parts.forEach((text, i) => {
        if (i) td.append(' ');
        td.append(Object.assign(document.createElement('span'), { textContent: text }));
    });
    return td;
}

export class LogPanel {
    /** @param {import('../logbook.js').LogBook} logbook */
    constructor(logbook) {
        this.logbook = logbook;
        logbook.addEventListener('change', () => this.render());
        $('log-download').addEventListener('click', () => this.download());
        $('log-delete').addEventListener('click', () => {
            const n = logbook.saved.length;
            if (n && confirm(TEXT.confirmDelete(n))) logbook.clear();
        });
        this.render();
    }

    download() {
        const { logbook } = this;
        const text = logbook.toAdif();
        const myCall = logbook.saved.at(-1)?.myCall || 'ft8';
        const d = new Date();
        const name = `${myCall.replace(/[^A-Z0-9]+/gi, '-')}-ft8-log-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}.adi`;
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    render() {
        const { logbook } = this;
        const entries = logbook.entries;
        const saved = logbook.saved.length;
        $('log-rows').replaceChildren(...entries.map((q) => this.row(q)));
        $('log-empty').hidden = entries.length > 0;
        $('log-test-note').hidden = logbook.testEntries.length === 0;
        $('log-count').textContent = entries.length ? TEXT.count(saved, logbook.testEntries.length) : '';
        $('log-download').disabled = saved === 0;
        $('log-delete').disabled = saved === 0;
        $('log-error').hidden = !logbook.saveError;
        $('log-error').textContent = logbook.saveError ? TEXT.saveError(logbook.saveError) : '';
    }

    row(q) {
        const tr = document.createElement('tr');
        if (q.test) tr.className = 'log-test';
        tr.appendChild(partsCell(utcDateTime(q.startTime ?? q.endTime)));
        for (const v of [q.dxCall, q.dxGrid ?? '', q.sentReport ?? '', q.rcvdReport ?? '']) {
            const td = document.createElement('td');
            td.textContent = v;
            tr.appendChild(td);
        }
        let td = document.createElement('td');
        if (q.test) {
            td.textContent = TEXT.testRow;
        } else if (q.dialHz) {
            const band = bandName(q.dialHz);
            td = partsCell(band ? [`${band} ·`, formatMHz(q.dialHz)] : [formatMHz(q.dialHz)]);
        } else {
            td.textContent = TEXT.noDial;
            td.className = 'missing';
            td.title = TEXT.noDialTitle;
        }
        tr.appendChild(td);
        return tr;
    }
}
