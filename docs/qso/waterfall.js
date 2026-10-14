// Scrolling waterfall: frequency left to right, newest row at the top, one row per symbol
// period (160 ms for FT8). Colour shows power above each row's noise floor.
//
// Keeps a history of rows, so the view can zoom in frequency (and time) and pan back
// through earlier slots. Decoded messages are labelled on their signals.
//
// Mouse: wheel zooms frequency around the pointer (Alt+wheel zooms time), Shift+wheel or a
// sideways scroll pans frequency, dragging pans frequency and time, double-click resets.
// Touch: drag to pan, pinch to zoom. Keyboard (when focused): arrows pan, + and - zoom,
// 0 resets, Home goes back to live.

const HISTORY_ROWS = 20 * 93;  // about 20 FT8 slots (5 minutes)
const MIN_SPAN_HZ = 50;        // narrowest frequency view
const MIN_ROWS = 24;           // most zoomed-in time view, in rows
const DEFAULT_ROWS = 4 * 93;   // rows shown before any time zoom: about four slots

// Sequential palette, dark (noise floor) to bright (strong signal).
const STOPS = [
    [0.00, [8, 10, 30]],
    [0.25, [20, 50, 130]],
    [0.50, [20, 140, 160]],
    [0.75, [240, 210, 60]],
    [1.00, [255, 255, 235]],
];
const PALETTE = (() => {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
        const x = i / 255;
        let k = 0;
        while (k < STOPS.length - 2 && x > STOPS[k + 1][0]) k++;
        const [x0, c0] = STOPS[k], [x1, c1] = STOPS[k + 1];
        const t = (x - x0) / (x1 - x0);
        for (let c = 0; c < 3; c++) lut[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * t;
    }
    return lut;
})();

const FLOOR_DB = -3;  // this far below the row's median maps to the darkest colour
const RANGE_DB = 33;  // the brightest colour is this far above that

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const pad2 = (n) => String(n).padStart(2, '0');

export class Waterfall {
    /**
     * @param {HTMLElement} root element containing a <canvas>, .wf-axis, .wf-readout,
     *   and buttons with data-wf="zoom-in|zoom-out|reset|live"
     */
    constructor(root) {
        this.root = root;
        this.canvas = root.querySelector('canvas');
        this.axis = root.querySelector('.wf-axis');
        this.readout = root.querySelector('.wf-readout');
        this.ctx = this.canvas.getContext('2d');
        this.geometry = null;

        // Colour image of the history, newest row at y = 0 (shifted down as rows arrive).
        this.image = document.createElement('canvas');
        this.imageCtx = this.image.getContext('2d');
        this.rows = [];        // raw rows, newest first: { data: Uint8Array, floor: number, time: number|null }
        this.rowsAdded = 0;    // total rows ever added; the newest row's index is rowsAdded - 1
        this.marks = [];       // slot starts: { row, label, key }
        this.labels = new Map(); // slot key -> decodes [{ freqHz, dt, text }]
        this.highlightHz = null;
        this.hover = null;     // { x, y } in CSS pixels

        // View: frequency range, and time as the row index at the top plus rows shown.
        this.fLo = 0;
        this.fHi = 1;
        this.live = true;
        this.rowTop = 0;
        this.rowsVisible = DEFAULT_ROWS;

        this.pointers = new Map();
        this.renderQueued = false;
        this.bindEvents();
        new ResizeObserver(() => this.queueRender()).observe(this.canvas);
    }

    /** @param {{numBins: number, minFreq: number, binHz: number}} geometry */
    setGeometry(geometry) {
        this.geometry = geometry;
        this.image.width = geometry.numBins;
        this.image.height = HISTORY_ROWS;
        this.imageCtx.fillStyle = `rgb(${PALETTE[0]},${PALETTE[1]},${PALETTE[2]})`;
        this.imageCtx.fillRect(0, 0, this.image.width, this.image.height);
        this.rowImage = this.imageCtx.createImageData(geometry.numBins, 1);
        this.resetView();
    }

    get minFreq() { return this.geometry.minFreq; }
    get maxFreq() { return this.geometry.minFreq + this.geometry.numBins * this.geometry.binHz; }
    get newestRow() { return this.rowsAdded - 1; }
    get oldestRow() { return Math.max(0, this.rowsAdded - this.rows.length); }

    // ---- Data ----

    /** Marks the start of a slot; the line and label are drawn above the slot's first row. */
    markSlot(label, key) {
        this.pendingMark = { label, key };
    }

    /**
     * @param {Uint8Array} row waterfall values, v means (v / 2 - 120) dB
     * @param {number|null} time time of the row (ms), shown when hovering; null for recordings
     */
    addRow(row, time = null) {
        if (!this.geometry) return;
        const sorted = Uint8Array.from(row).sort();
        const floor = sorted[sorted.length >> 1] / 2 - 120 + FLOOR_DB;

        // Shift the history image down one row and colour the new row at the top.
        const ic = this.imageCtx, img = this.image;
        ic.drawImage(img, 0, 0, img.width, img.height - 1, 0, 1, img.width, img.height - 1);
        const data = this.rowImage.data;
        for (let b = 0; b < row.length; b++) {
            const db = row[b] / 2 - 120;
            const i = clamp(Math.round((db - floor) / RANGE_DB * 255), 0, 255);
            data[b * 4] = PALETTE[i * 3];
            data[b * 4 + 1] = PALETTE[i * 3 + 1];
            data[b * 4 + 2] = PALETTE[i * 3 + 2];
            data[b * 4 + 3] = 255;
        }
        ic.putImageData(this.rowImage, 0, 0);

        this.rows.unshift({ data: row, floor, time });
        if (this.rows.length > HISTORY_ROWS) this.rows.pop();
        this.rowsAdded++;
        if (this.pendingMark) {
            this.marks.push({ row: this.newestRow, ...this.pendingMark });
            this.pendingMark = null;
        }
        this.marks = this.marks.filter(m => m.row >= this.oldestRow);
        if (this.live) this.rowTop = this.newestRow;
        this.queueRender();
    }

    /** Labels a slot's decoded messages on their signals. */
    addDecodes(key, decodes) {
        this.labels.set(key, decodes.map(d => ({ freqHz: d.freqHz, dt: d.dt, text: d.text })));
        const keep = new Set(this.marks.map(m => m.key));
        for (const k of this.labels.keys()) if (!keep.has(k)) this.labels.delete(k);
        this.queueRender();
    }

    /** Outlines a signal (e.g. while its line in band activity is hovered); null removes it. */
    showSignal(freqHz) {
        this.highlightHz = freqHz;
        this.queueRender();
    }

    // ---- View ----

    resetView() {
        if (!this.geometry) return;
        this.fLo = this.minFreq;
        this.fHi = this.maxFreq;
        this.rowsVisible = DEFAULT_ROWS;
        this.goLive();
    }

    goLive() {
        this.live = true;
        this.rowTop = this.newestRow;
        this.queueRender();
    }

    setFreqRange(lo, hi) {
        const full = this.maxFreq - this.minFreq;
        const span = clamp(hi - lo, MIN_SPAN_HZ, full);
        const centre = (lo + hi) / 2;
        lo = clamp(centre - span / 2, this.minFreq, this.maxFreq - span);
        this.fLo = lo;
        this.fHi = lo + span;
        this.queueRender();
    }

    zoomFreq(factor, aroundHz = (this.fLo + this.fHi) / 2) {
        const lo = aroundHz - (aroundHz - this.fLo) / factor;
        const hi = aroundHz + (this.fHi - aroundHz) / factor;
        this.setFreqRange(lo, hi);
    }

    panFreq(deltaHz) {
        this.setFreqRange(this.fLo + deltaHz, this.fHi + deltaHz);
    }

    /** Positive delta moves towards newer rows. */
    panRows(deltaRows) {
        if (this.rowsAdded === 0) return;
        const lowest = this.oldestRow + Math.min(this.rowsVisible, this.rows.length) - 1;
        this.rowTop = Math.round(clamp(this.rowTop + deltaRows, lowest, this.newestRow));
        this.live = this.rowTop >= this.newestRow;
        this.queueRender();
    }

    zoomRows(factor) {
        this.rowsVisible = clamp(Math.round(this.rowsVisible / factor), MIN_ROWS, HISTORY_ROWS);
        this.panRows(0);
    }

    get hzPerPx() { return (this.fHi - this.fLo) / this.canvas.clientWidth; }
    get rowsPerPx() { return this.rowsVisible / this.canvas.clientHeight; }
    xToHz(x) { return this.fLo + x * this.hzPerPx; }
    hzToX(hz) { return (hz - this.fLo) / this.hzPerPx; }
    rowToY(row) { return (this.rowTop - row) / this.rowsPerPx; }
    yToRow(y) { return Math.round(this.rowTop - y * this.rowsPerPx); }

    // ---- Interaction ----

    bindEvents() {
        const c = this.canvas;
        c.tabIndex = 0;
        c.addEventListener('wheel', (e) => {
            if (!this.geometry) return;
            e.preventDefault();
            if (e.altKey) {
                this.zoomRows(Math.exp(-e.deltaY * 0.0015));
            } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                this.panFreq((e.shiftKey ? e.deltaY : e.deltaX) * this.hzPerPx);
            } else {
                this.zoomFreq(Math.exp(-e.deltaY * 0.0015), this.xToHz(e.offsetX));
            }
        }, { passive: false });

        c.addEventListener('pointerdown', (e) => {
            c.setPointerCapture(e.pointerId);
            this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
        });
        c.addEventListener('pointermove', (e) => {
            const prev = this.pointers.get(e.pointerId);
            if (e.pointerType === 'mouse' || this.pointers.size <= 1) this.hover = { x: e.offsetX, y: e.offsetY };
            if (prev && this.geometry) {
                if (this.pointers.size === 1) {
                    this.panFreq(-(e.offsetX - prev.x) * this.hzPerPx);
                    this.panRows((e.offsetY - prev.y) * this.rowsPerPx);
                } else if (this.pointers.size === 2) {
                    // Pinch: zoom frequency by the change in horizontal distance between the fingers.
                    const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
                    const before = Math.abs(prev.x - other.x), after = Math.abs(e.offsetX - other.x);
                    if (before > 10 && after > 10) this.zoomFreq(after / before, this.xToHz((e.offsetX + other.x) / 2));
                }
                this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
            }
            this.queueRender();
        });
        const end = (e) => { this.pointers.delete(e.pointerId); };
        c.addEventListener('pointerup', end);
        c.addEventListener('pointercancel', end);
        c.addEventListener('pointerleave', () => { this.hover = null; this.queueRender(); });
        c.addEventListener('dblclick', () => this.resetView());
        c.addEventListener('keydown', (e) => {
            if (!this.geometry) return;
            const step = (this.fHi - this.fLo) * 0.1;
            const action = {
                ArrowLeft: () => this.panFreq(-step),
                ArrowRight: () => this.panFreq(step),
                ArrowUp: () => this.panRows(this.rowsVisible * 0.25),
                ArrowDown: () => this.panRows(-this.rowsVisible * 0.25),
                '+': () => this.zoomFreq(1.5),
                '=': () => this.zoomFreq(1.5),
                '-': () => this.zoomFreq(1 / 1.5),
                '0': () => this.resetView(),
                Home: () => this.goLive(),
            }[e.key];
            if (action) { e.preventDefault(); action(); }
        });

        this.root.querySelectorAll('[data-wf]').forEach((btn) => btn.addEventListener('click', () => {
            if (!this.geometry) return;
            ({
                'zoom-in': () => this.zoomFreq(2),
                'zoom-out': () => this.zoomFreq(0.5),
                'reset': () => this.resetView(),
                'live': () => this.goLive(),
            })[btn.dataset.wf]?.();
        }));
    }

    // ---- Drawing ----

    queueRender() {
        if (this.renderQueued) return;
        this.renderQueued = true;
        requestAnimationFrame(() => {
            this.renderQueued = false;
            this.render();
        });
    }

    render() {
        const c = this.canvas, ctx = this.ctx;
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth, h = c.clientHeight;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
            c.width = Math.round(w * dpr);
            c.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = `rgb(${PALETTE[0]},${PALETTE[1]},${PALETTE[2]})`;
        ctx.fillRect(0, 0, w, h);
        if (!this.geometry || w === 0) return;

        // History image -> view. Image x is the bin, image y is (newestRow - row).
        const binHz = this.geometry.binHz;
        const sx = (this.fLo - this.minFreq) / binHz;
        const sw = (this.fHi - this.fLo) / binHz;
        const sy = this.newestRow - this.rowTop;
        const available = Math.min(this.rowsVisible, this.rows.length - sy);
        if (available > 0) {
            ctx.imageSmoothingEnabled = sw > w / 2; // show wide bins as blocks when zoomed in
            ctx.drawImage(this.image, sx, sy, sw, available, 0, 0, w, available / this.rowsPerPx);
        }

        // Slot lines and labels.
        ctx.font = '11px system-ui, sans-serif';
        ctx.textBaseline = 'bottom';
        for (const m of this.marks) {
            const y = Math.round(this.rowToY(m.row) + 1 / this.rowsPerPx); // just below the slot's first row
            if (y < 0 || y > h + 1) continue;
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillRect(0, y, w, 1);
            if (m.label) {
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.fillText(m.label, 4, y - 2);
            }
        }

        // Decoded messages, labelled at the top (latest) end of each signal's trace.
        for (const m of this.marks) {
            const decodes = this.labels.get(m.key);
            if (!decodes) continue;
            for (const d of decodes) {
                const startRow = m.row + Math.round((0.5 + d.dt) / 0.16);
                const y = this.rowToY(startRow + 79);
                const x = this.hzToX(d.freqHz);
                if (y < 14 || y > h || x < -200 || x > w) continue;
                const tw = ctx.measureText(d.text).width;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(x - 1, y - 14, tw + 5, 14);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(d.text, x + 1, y - 1);
            }
        }

        // Outline of a hovered band activity line's signal (8 tones, 50 Hz for FT8).
        if (this.highlightHz != null) {
            const x0 = this.hzToX(this.highlightHz), x1 = this.hzToX(this.highlightHz + 50);
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x0, 1, Math.max(4, x1 - x0), h - 2);
        }

        // Pointer line.
        if (this.hover) {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(Math.round(this.hover.x) + 0.5, 0);
            ctx.lineTo(Math.round(this.hover.x) + 0.5, h);
            ctx.stroke();
        }

        this.drawAxis(w);
        this.updateReadout();
        this.root.querySelector('[data-wf="live"]')?.toggleAttribute('hidden', this.live);
    }

    drawAxis(width) {
        const span = this.fHi - this.fLo;
        const maxLabels = Math.max(2, Math.floor(width / 80));
        const step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => span / s <= maxLabels) ?? 1000;
        const key = `${this.fLo.toFixed(1)}:${this.fHi.toFixed(1)}:${step}`;
        if (key === this.axisKey) return;
        this.axisKey = key;
        this.axis.replaceChildren();
        for (let f = Math.ceil(this.fLo / step) * step; f <= this.fHi; f += step) {
            const tick = document.createElement('span');
            tick.className = 'wf-tick';
            const x = (f - this.fLo) / span;
            tick.style.left = `${(x * 100).toFixed(2)}%`;
            if (x > 0.94) tick.classList.add('wf-tick-end');   // keep labels inside the frame
            if (x < 0.04) tick.classList.add('wf-tick-start');
            tick.textContent = step >= 500 && f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${f} Hz`;
            this.axis.appendChild(tick);
        }
    }

    updateReadout() {
        if (!this.readout) return;
        if (!this.hover || !this.geometry) {
            const span = `${Math.round(this.fLo)} to ${Math.round(this.fHi)} Hz`;
            this.readout.textContent = this.live ? `${span}, latest` : `${span}, earlier`;
            return;
        }
        const hz = this.xToHz(this.hover.x);
        const r = this.rows[this.newestRow - this.yToRow(this.hover.y)];
        let text = `${Math.round(hz)} Hz`;
        if (r) {
            if (r.time != null) {
                const d = new Date(r.time);
                text += ` · ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.${Math.floor(d.getUTCMilliseconds() / 100)} UTC`;
            }
            const bin = Math.floor((hz - this.minFreq) / this.geometry.binHz);
            if (bin >= 0 && bin < r.data.length) {
                const above = r.data[bin] / 2 - 120 - (r.floor - FLOOR_DB);
                text += ` · ${above >= 0 ? '+' : '−'}${Math.abs(above).toFixed(0)} dB vs noise`;
            }
        }
        this.readout.textContent = text;
    }
}
