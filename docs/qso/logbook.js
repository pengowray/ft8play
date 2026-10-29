// The QSO log. QSOs are saved in the browser (localStorage) and kept between visits;
// QSOs made in test mode are kept only until the page closes, and are never exported.
// No DOM, apart from listening for other tabs changing the saved log.
//
// Events (CustomEvent): 'change' (an entry was added, the log was deleted, or another tab
// changed the saved log).

import { toAdif } from './adif.js';

const STORAGE_KEY = 'qso.log';

/**
 * @typedef {{startTime: number, endTime: number, dxCall: string, dxGrid?: string, sentReport?: string,
 *            rcvdReport?: string, myCall: string, myGrid: string, dialHz: number|null, txFreqHz: number,
 *            mode: string, test?: boolean}} LogEntry
 */

export class LogBook extends EventTarget {
    /** @param {{storage?: Storage|null}} options storage: where saved QSOs live (default localStorage) */
    constructor({ storage } = {}) {
        super();
        try { this.storage = storage === undefined ? globalThis.localStorage ?? null : storage; } catch { this.storage = null; }
        this.saved = this.read();
        this.testEntries = [];
        this.saveError = this.storage ? '' : 'storage unavailable';
        globalThis.addEventListener?.('storage', (e) => {
            if (e.key !== STORAGE_KEY) return;
            this.saved = this.read();
            this.changed();
        });
    }

    /** Saved QSOs from storage, oldest first. */
    read() {
        try {
            const list = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '[]');
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    }

    write() {
        try {
            this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.saved));
            this.saveError = this.storage ? '' : 'storage unavailable';
        } catch (err) {
            this.saveError = err.message || String(err);
        }
    }

    /** All QSOs to show, newest first, test-mode ones included. */
    get entries() {
        return [...this.saved, ...this.testEntries].sort((a, b) => b.endTime - a.endTime);
    }

    /** @param {LogEntry} entry */
    add(entry) {
        if (entry.test) {
            this.testEntries.push(entry);
        } else {
            // Read again first, so a QSO logged in another tab isn't overwritten.
            this.saved = [...this.read(), entry];
            this.write();
        }
        this.changed();
    }

    /** Deletes every saved QSO (and the test-mode ones). */
    clear() {
        this.saved = [];
        this.testEntries = [];
        try { this.storage?.removeItem(STORAGE_KEY); } catch (err) { this.saveError = err.message || String(err); }
        this.changed();
    }

    /** The saved QSOs as an ADIF file. */
    toAdif(options) {
        return toAdif(this.saved, options);
    }

    changed() {
        this.dispatchEvent(new CustomEvent('change'));
    }
}
