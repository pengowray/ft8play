// Band activity: decoded messages, newest slot first, sorted by frequency within a slot.
// Messages addressed to my call are marked strongly; CQ calls lightly.

const MAX_SLOTS = 40;

const pad2 = (n) => String(n).padStart(2, '0');
export function utcTime(ms) {
    const d = new Date(ms);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

export class BandActivity {
    /**
     * @param {HTMLElement} root element containing a <tbody>-less <table> and an .ba-empty element
     * @param {{onHover?: (decode: object|null) => void}} options
     */
    constructor(root, { onHover = () => {} } = {}) {
        this.root = root;
        this.table = root.querySelector('table');
        this.empty = root.querySelector('.ba-empty');
        this.onHover = onHover;
        this.myCall = '';
        this.slots = []; // newest first: { key, title, decodes, tbody }
    }

    setMyCall(call) {
        this.myCall = (call || '').trim().toUpperCase();
        for (const s of this.slots) this.renderSlot(s);
    }

    /**
     * @param {{slot: any, start: number|null, label: string|null, decodes: Array}} result
     */
    addSlot({ slot, start, label, receivedSeconds, decodes }) {
        const time = start != null ? utcTime(start) : null;
        const count = `${decodes.length} message${decodes.length === 1 ? '' : 's'}`;
        let title = start != null ? `${time} UTC · ${count}` : `${label} · ${count}`;
        // A slot heard only in part (receiving started or stopped during it) can't decode fully.
        if (start != null && receivedSeconds != null && receivedSeconds < 13) {
            title += ` · only ${receivedSeconds.toFixed(0)} s of this slot received`;
        }
        const s = { key: slot, time, title, decodes, tbody: document.createElement('tbody') };
        this.slots.unshift(s);
        this.renderSlot(s);
        this.table.querySelector('thead').after(s.tbody);
        while (this.slots.length > MAX_SLOTS) this.slots.pop().tbody.remove();
        this.empty.hidden = true;
    }

    /** What kind of message this is, for the user: addressed to me, a CQ, or other. */
    classify(text) {
        const words = text.split(' ');
        if (this.myCall && words.some(w => w.replace(/[<>]/g, '') === this.myCall)) {
            return words[0].replace(/[<>]/g, '') === this.myCall ? 'to-me' : 'from-me';
        }
        if (words[0] === 'CQ') return 'cq';
        return '';
    }

    renderSlot(s) {
        const rows = [];
        const header = document.createElement('tr');
        header.className = 'ba-slot';
        const th = document.createElement('th');
        th.colSpan = 5;
        th.scope = 'rowgroup';
        th.textContent = s.title;
        header.appendChild(th);
        rows.push(header);

        for (const d of s.decodes) {
            const tr = document.createElement('tr');
            const kind = this.classify(d.text);
            if (kind) tr.className = `ba-${kind}`;
            const cells = [
                s.time ?? '',
                d.snr == null ? '' : String(Math.round(d.snr)),
                d.dt.toFixed(1),
                String(Math.round(d.freqHz)),
                d.text,
            ];
            cells.forEach((value, i) => {
                const td = document.createElement('td');
                td.textContent = value;
                if (i === 4) {
                    td.className = 'ba-msg';
                    if (kind === 'to-me') {
                        const tag = document.createElement('span');
                        tag.className = 'ba-tag';
                        tag.textContent = 'To you';
                        td.appendChild(tag);
                    }
                }
                tr.appendChild(td);
            });
            tr.addEventListener('mouseenter', () => this.onHover(d));
            tr.addEventListener('mouseleave', () => this.onHover(null));
            rows.push(tr);
        }
        if (s.decodes.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.className = 'ba-none';
            td.textContent = 'No messages decoded in this slot.';
            tr.appendChild(td);
            rows.push(tr);
        }
        s.tbody.replaceChildren(...rows);
    }

    clear() {
        for (const s of this.slots) s.tbody.remove();
        this.slots = [];
        this.empty.hidden = false;
    }
}
