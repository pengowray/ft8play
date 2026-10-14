// A text command link over a serial port (Web Serial, or a test double with the same shape),
// for CAT protocols where commands and replies end with ';' (Kenwood, Yaesu newer radios).

export class SerialLink {
    /**
     * @param {{readable: ReadableStream, writable: WritableStream, setSignals?: Function, close?: Function}} port
     *   an open SerialPort (or a fake with readable/writable streams)
     */
    constructor(port) {
        this.port = port;
        this.writer = port.writable.getWriter();
        this.encoder = new TextEncoder();
        this.buffer = '';
        this.waiters = [];      // { prefix, resolve, reject, timer }
        this.closed = false;
        this.onUnsolicited = null;
        this.reading = this.readLoop();
        this.queue = Promise.resolve();
    }

    async readLoop() {
        const reader = this.port.readable.getReader();
        this.reader = reader;
        const decoder = new TextDecoder();
        try {
            while (!this.closed) {
                const { value, done } = await reader.read();
                if (done) break;
                this.buffer += decoder.decode(value, { stream: true });
                let end;
                while ((end = this.buffer.indexOf(';')) >= 0) {
                    const reply = this.buffer.slice(0, end + 1).replace(/^[\r\n]+/, '');
                    this.buffer = this.buffer.slice(end + 1);
                    this.dispatch(reply);
                }
            }
        } catch (err) {
            if (!this.closed) this.failAll(err);
        } finally {
            reader.releaseLock();
        }
    }

    dispatch(reply) {
        const i = this.waiters.findIndex(w => reply.startsWith(w.prefix));
        if (i >= 0) {
            const [w] = this.waiters.splice(i, 1);
            clearTimeout(w.timer);
            w.resolve(reply);
        } else {
            this.onUnsolicited?.(reply);
        }
    }

    failAll(err) {
        for (const w of this.waiters.splice(0)) { clearTimeout(w.timer); w.reject(err); }
    }

    /** Sends a command without waiting for a reply. Commands go out in order. */
    send(command) {
        this.queue = this.queue.then(() => this.writer.write(this.encoder.encode(command)));
        return this.queue;
    }

    /**
     * Sends a command and waits for the reply that starts with `prefix` (by default the
     * command's first two characters).
     */
    request(command, { prefix = command.slice(0, 2), timeoutMs = 800 } = {}) {
        return new Promise((resolve, reject) => {
            const w = { prefix, resolve, reject };
            w.timer = setTimeout(() => {
                this.waiters = this.waiters.filter(x => x !== w);
                reject(new Error(`No reply to ${command}`));
            }, timeoutMs);
            this.waiters.push(w);
            this.send(command).catch(reject);
        });
    }

    /** RTS or DTR line, for interfaces that key PTT with a control line. */
    async setLine(line, on) {
        await this.port.setSignals?.({ [line === 'dtr' ? 'dataTerminalReady' : 'requestToSend']: on });
    }

    async close() {
        this.closed = true;
        this.failAll(new Error('Link closed'));
        try { await this.reader?.cancel(); } catch { /* already closed */ }
        await this.reading;
        try { this.writer.releaseLock(); } catch { /* already released */ }
        await this.port.close?.();
    }
}
