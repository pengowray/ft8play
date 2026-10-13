// Scrolling waterfall: frequency left to right, newest row at the top, one row per symbol
// period (160 ms for FT8). Colour shows power above the row's noise floor.

const ROWS = 4 * 93; // about four FT8 slots

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

export class Waterfall {
    /**
     * @param {HTMLElement} root element containing a <canvas>, an axis element and a highlight element
     */
    constructor(root) {
        this.root = root;
        this.canvas = root.querySelector('canvas');
        this.axis = root.querySelector('.wf-axis');
        this.highlight = root.querySelector('.wf-highlight');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
        this.geometry = null;
        this.pendingBoundary = null;
        new ResizeObserver(() => { if (this.geometry) this.drawAxis(); }).observe(this.axis);
    }

    /** @param {{numBins: number, minFreq: number, binHz: number}} geometry */
    setGeometry(geometry) {
        this.geometry = geometry;
        this.canvas.width = geometry.numBins;
        this.canvas.height = ROWS;
        this.ctx.fillStyle = `rgb(${PALETTE[0]},${PALETTE[1]},${PALETTE[2]})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.rowImage = this.ctx.createImageData(geometry.numBins, 1);
        this.drawAxis();
    }

    get minFreq() { return this.geometry.minFreq; }
    get maxFreq() { return this.geometry.minFreq + this.geometry.numBins * this.geometry.binHz; }

    /** Horizontal position of a frequency, 0 to 1. */
    xOf(freqHz) {
        return (freqHz - this.minFreq) / (this.maxFreq - this.minFreq);
    }

    drawAxis() {
        this.axis.replaceChildren();
        // A tick every 500 Hz; on narrow screens, only every second one is labelled.
        const labelEvery = (this.axis.clientWidth || 800) < 520 ? 1000 : 500;
        for (let f = Math.ceil(this.minFreq / 500) * 500; f <= this.maxFreq; f += 500) {
            const tick = document.createElement('span');
            tick.className = 'wf-tick';
            tick.style.left = `${(this.xOf(f) * 100).toFixed(2)}%`;
            if (f % labelEvery !== 0) {
                tick.classList.add('wf-tick-minor');
            } else {
                if (this.xOf(f) > 0.95) tick.classList.add('wf-tick-end'); // keep the label inside the frame
                tick.textContent = f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${f} Hz`;
            }
            this.axis.appendChild(tick);
        }
    }

    /** Marks the start of a slot; the line and label are drawn with the slot's first row. */
    markSlot(label) {
        this.pendingBoundary = label;
    }

    /** @param {Uint8Array} row waterfall values, v means (v / 2 - 120) dB */
    addRow(row) {
        if (!this.geometry) return;
        const { ctx, canvas } = this;
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height - 1, 0, 1, canvas.width, canvas.height - 1);

        const sorted = Uint8Array.from(row).sort();
        const floorDb = sorted[sorted.length >> 1] / 2 - 120 + FLOOR_DB;
        const data = this.rowImage.data;
        for (let b = 0; b < row.length; b++) {
            const db = row[b] / 2 - 120;
            const i = Math.max(0, Math.min(255, Math.round((db - floorDb) / RANGE_DB * 255)));
            data[b * 4] = PALETTE[i * 3];
            data[b * 4 + 1] = PALETTE[i * 3 + 1];
            data[b * 4 + 2] = PALETTE[i * 3 + 2];
            data[b * 4 + 3] = 255;
        }
        ctx.putImageData(this.rowImage, 0, 0);

        if (this.pendingBoundary != null) {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(0, 0, canvas.width, 1);
            if (this.pendingBoundary) {
                ctx.font = '11px sans-serif';
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillText(this.pendingBoundary, 4, 12);
            }
            this.pendingBoundary = null;
        }
    }

    /** Shows a band over a signal (e.g. when its line in band activity is hovered); null hides it. */
    showSignal(freqHz, bandwidthHz = 50) {
        if (freqHz == null || !this.geometry) {
            this.highlight.hidden = true;
            return;
        }
        this.highlight.hidden = false;
        this.highlight.style.left = `${(this.xOf(freqHz) * 100).toFixed(2)}%`;
        this.highlight.style.width = `${(bandwidthHz / (this.maxFreq - this.minFreq) * 100).toFixed(2)}%`;
    }
}
