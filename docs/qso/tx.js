// Transmitter: turns a message into FT8 audio and plays it at the right moment in a slot.
//
// Timing (as WSJT-X): PTT on at the slot boundary, audio from 0.5 s, PTT off just after the
// audio ends (12.64 s of audio, so about 13.2 s into the slot). Times are scheduled on the
// AudioContext clock, which keeps time even when the page is in the background, rather
// than with setTimeout.
//
// PTT is not done here: listen for the events and key the radio (see radio/*.js).
// Events (CustomEvent, detail = the transmission):
//   'scheduled' a transmission is booked for a slot
//   'ptton'     key the transmitter now (at the slot boundary)
//   'audiostart' audio has started
//   'pttoff'    unkey now (audio finished, or halted)
//   'done'      the transmission is over; detail.halted is true if it was stopped early

import { wsjtxEncode } from '../wsjtx/wsjtx_engine.js';
import { bitsToTones, genFt8Wave } from './ft8_wave.js';
import { txDurationSeconds } from './modes.js';

const PTT_TAIL_MS = 100; // keep PTT on this long after the audio ends

export class Transmitter extends EventTarget {
    /**
     * @param {{clock: import('./slot_clock.js').SlotClock}} options
     */
    constructor({ clock }) {
        super();
        this.clock = clock;
        this.mode = clock.mode;
        this.context = null;
        this.gain = null;
        this.level = 0.5;            // output amplitude, 0 to 1
        this.outputDeviceId = '';
        this.current = null;         // the scheduled or active transmission
        this.listeners = [];         // test sinks: (transmission) => void, see addLoopback()
        this.useSoundCard = true;
    }

    /**
     * Packs a message as WSJT-X would.
     * @returns {{text: string, sent: string, c77: string, tones: Uint8Array, warning: string|null}}
     */
    prepare(text) {
        const r = wsjtxEncode(text);
        if (!r.success) throw new Error(`Can't send "${text}": WSJT-X would reject it`);
        const sent = r.msgsent;
        const normalised = text.trim().toUpperCase().replace(/\s+/g, ' ');
        return {
            text: normalised,
            sent,
            c77: r.c77,
            tones: bitsToTones(r.c77),
            // e.g. free text cut to 13 characters, or a hashed call shown differently
            warning: sent !== normalised ? `Will be sent as "${sent}"` : null,
        };
    }

    /** Must be called from a user gesture (click) the first time, so the browser allows audio. */
    async ensureAudio() {
        if (!this.context) {
            this.context = new AudioContext({ latencyHint: 'interactive' });
            this.gain = this.context.createGain();
            this.gain.gain.value = this.level;
            this.gain.connect(this.context.destination);
            if (this.outputDeviceId && this.context.setSinkId) await this.context.setSinkId(this.outputDeviceId);
        }
        if (this.context.state !== 'running') await this.context.resume();
    }

    async setOutputDevice(deviceId) {
        this.outputDeviceId = deviceId;
        if (this.context?.setSinkId) await this.context.setSinkId(deviceId || '');
    }

    setLevel(level) {
        this.level = level;
        if (this.gain) this.gain.gain.value = level;
    }

    /** Adds a receiver of transmitted audio for testing (the test-signals source uses it). */
    addLoopback(listener) {
        this.listeners.push(listener);
        return () => { this.listeners = this.listeners.filter(l => l !== listener); };
    }

    /**
     * Books a transmission in a slot.
     * @param {object} prepared from prepare()
     * @param {{slot: number, freqHz: number}} options
     */
    async schedule(prepared, { slot, freqHz }) {
        if (this.current) throw new Error('Already transmitting');
        const slotStart = this.clock.slotStart(slot);
        const audioStart = slotStart + this.mode.txStartSeconds * 1000;
        const audioEnd = audioStart + txDurationSeconds(this.mode) * 1000;
        const tx = { ...prepared, slot, freqHz, slotStart, audioStart, audioEnd, halted: false, nodes: [] };
        this.current = tx;
        this.emit('scheduled', tx);

        for (const listener of this.listeners) listener(tx);

        if (this.useSoundCard) {
            await this.ensureAudio();
            const ctx = this.context;
            const wave = genFt8Wave(prepared.tones, { sampleRate: ctx.sampleRate, f0: freqHz, symbolSeconds: this.mode.symbolSeconds });
            const buffer = ctx.createBuffer(1, wave.length, ctx.sampleRate);
            buffer.copyToChannel(wave, 0);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.gain);
            source.start(this.contextTime(audioStart));
            tx.nodes.push(source);
        }
        // Event timers on the audio clock (silent sources that end at the right moments).
        this.at(slotStart, () => this.emit('ptton', tx));
        this.at(audioStart, () => this.emit('audiostart', tx));
        this.at(audioEnd + PTT_TAIL_MS, () => this.finish(tx));
        return tx;
    }

    /** Stops the current transmission now (audio and PTT). */
    halt() {
        const tx = this.current;
        if (!tx) return;
        tx.halted = true;
        this.finish(tx);
    }

    finish(tx) {
        if (tx !== this.current) return;
        for (const node of tx.nodes) {
            try { node.onended = null; node.stop(); } catch { /* already stopped */ }
        }
        this.current = null;
        this.emit('pttoff', tx);
        this.emit('done', tx);
    }

    /** AudioContext time (s) for a corrected clock time (ms). */
    contextTime(ms) {
        const ctx = this.context;
        const deviceMs = this.clock.toDeviceTime(ms);
        const ts = ctx.getOutputTimestamp?.();
        if (ts && ts.performanceTime) {
            // contextTime is the sample being heard now; performanceTime is when.
            return ts.contextTime + (deviceMs - (performance.timeOrigin + ts.performanceTime)) / 1000;
        }
        return ctx.currentTime + (deviceMs - Date.now()) / 1000 - (ctx.outputLatency || ctx.baseLatency || 0);
    }

    /** Runs fn at a corrected clock time: on the audio clock if there is one, else with a timer. */
    at(ms, fn) {
        const tx = this.current;
        if (this.context && this.useSoundCard) {
            const node = this.context.createConstantSource();
            node.offset.value = 0;
            node.connect(this.gain);
            node.onended = () => { if (!tx.halted) fn(); };
            node.start();
            node.stop(Math.max(this.context.currentTime, this.contextTime(ms)));
            tx.nodes.push(node);
        } else {
            const timer = setTimeout(() => { if (!tx.halted) fn(); }, Math.max(0, ms - this.clock.now()));
            tx.nodes.push({ stop: () => clearTimeout(timer) });
        }
    }

    emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }
}
