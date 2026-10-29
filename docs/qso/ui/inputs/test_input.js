// Test signals input for the receive panel: simulated FT8 stations, including one that
// completes QSOs (test mode: nothing is transmitted).

import { TestSignalSource } from '../../sources/test_signals.js';

export class TestSignalsInput {
    kind = 'test';
    realSignals = false;
    help = 'Simulated FT8 signals mixed with noise, for trying the page without a radio. A simulated station, WA9XYZ, calls CQ and answers your CQ.';
    levelWarning = ' · clipping, lower the recording level';

    show() {}

    async start({ clock, onAudio }) {
        const source = new TestSignalSource({ clock, onAudio });
        source.start();
        return source;
    }

    status() {
        return 'Receiving test signals';
    }

    startError() {
        return null;
    }
}
