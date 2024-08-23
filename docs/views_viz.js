
const showModes = [ 
    //{name: "Off", "mode": "off", "zoom": 1}, 
    {name: "Frequency Deviation", "mode": "dphi", "zoom": 1},  // aka "Unmodulated", or "frequency deviation waveform generated using the Gaussian smoothed frequency deviation pulse"
    {name: "Frequency Deviation (zoom)", "mode": "dphi", "zoom": 16}, 
    {name: "Waveform", "mode": "wave", "zoom": 256},
    {name: "Oscilloscope", "mode": "wave", "zoom": 2048},
];

class VizComponent extends Component {

    constructor(index, container) {        
        super(index, container);

        this.canvas = null;
        this.ctx = null;
        this.timeDisplay = null;
        this.interval = null;
    }

    create() {
        this.updateOn = 'frame';
        this.showMode = 0;

        //note: container must already contain a canvas element
        this.canvas = this.container.querySelector('#waveform-canvas'); // document.getElementById('waveform-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.VisualizationCaption = this.container.querySelector('#visualization-caption') 
        this.toggleVisualizationButton = this.container.querySelector('#toggle-visualization');
        this.toggleVisualizationButton.onclick = () => this.toggleVisualization();

        // TODO: move to a separate component
        this.timeDisplay = this.container.querySelector('#time-display') // document.getElementById('time-display'); 

        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = 200;
        
        this.toggleVisualization(0);

        window.addEventListener('resize', this.handleResize);
    }

    handleResize() {
        if (this.canvas) {
            this.canvas.width = this.canvas.clientWidth;
            //drawWaveform();
        }
    }

    messageUpdate() {
        // Update any cached data that depends on the message

        if (this.message != null && this.message.isplaying) {
            this.onPlay();
        } else {
            this.onStop();
        }
    }

    frameUpdate() {
        const canvas = this.canvas;
        const ctx = this.ctx;

        if (canvas == null) return;
        if (ctx == null) return;

        if (this.message == null) {
            const width = canvas.width;
            const height = canvas.height;
            const middle = height / 2;
            ctx.clearRect(0, 0, width, height);
            if (this.timeDisplay != null) this.timeDisplay.textContent = '';
            return;
        };

        this.message.readyAudioAndBuffer(); // needed for viz

        const timing = this.message.getTiming();
        //if (timing == null) return; // todo: or clear?

        // todo: keep track of if need to update when not playing
        //if (!timing.isPlaying) return;

        const currentTime = timing.currentTime ?? 0;
        const totalDuration = timing.duration ?? 0;

        // Update time display
        if (this.timeDisplay && this.timeDisplay.textContent && currentTime != null) {
            this.timeDisplay.textContent = `${currentTime.toFixed(2)} / ${totalDuration.toFixed(2)}`;
        } else {
            this.timeDisplay.textContent = '';
        }
        
        const mode = showModes[this.showMode];
        const showDphi = (mode['mode'] === 'dphi');
        const off = (mode['mode'] === 'off');

        const width = canvas.width;
        const height = canvas.height;
        const middle = height / 2;
        ctx.clearRect(0, 0, width, height);

        if (off) return;

        const message = this.message; // messageManager.getCurrentMessage();
        if (message == null) return;

        const sampleRate = message.sampleRate;

        ctx.beginPath();
        ctx.moveTo(0, middle);

        const zoomLevel = mode['zoom'];

        const data = showDphi ? message.dphiSamples : message.audioSamples;
        const levelsData = showDphi ? message.levelsSamples : null;

        if (!data || data.length === 0) {
            console.error(`No ${showDphi ? 'dphi samples' : 'audio samples'} to draw`);
            return;
        }

        const visibleDuration = totalDuration / zoomLevel;
        const samplesPerPixel = (sampleRate * visibleDuration) / width;

        let startTime = currentTime - visibleDuration / 2;
        let endTime = currentTime + visibleDuration / 2;

        // Adjust start and end times to prevent showing blank areas
        if (startTime <= 0) {
            startTime = 0;
            endTime = visibleDuration;
        } else if (endTime > totalDuration) {
            endTime = totalDuration;
            startTime = endTime - visibleDuration;
        }

        let startSample = Math.floor(startTime * sampleRate);
        let endSample = Math.floor(endTime * sampleRate);

        // Implement trigger-like behavior for high zoom levels
        if (!showDphi && zoomLevel > 2000) {
            const triggerWindowSamples = Math.floor(sampleRate * 0.01); // 0.001 = 1ms window (todo: consider actual data)
            //const triggerThreshold = 0.1;
            
            for (let i = startSample; i < startSample + triggerWindowSamples; i++) {
                if (i + 1 < data.length) {
                    if (data[i] <= 0 && data[i + 1] > 0) {
                        // || (Math.abs(data[i]) < triggerThreshold && Math.abs(data[i + 1]) >= triggerThreshold)) {

                        //todo: should probably do some of these calcs in samples instead of time, but matching earlier calcs
                        let newStartSample = i;
                        let newEndTime = (i / sampleRate) + visibleDuration;
                        if (endTime > totalDuration) {
                            break; // trigger is too late, ignore
                            //endTime = totalDuration;
                            //startTime = endTime - (visibleDuration / sampleRate);
                            //startSample = Math.floor(startTime * sampleRate); 
                        }

                        startSample = newStartSample;
                        endSample = Math.floor(newEndTime * sampleRate);
                        break;
                    }
                }
            }
        }
        const doDraw = (dat, isPrescaled, color) => {
            ctx.beginPath();
            ctx.moveTo(0, middle);

            let lastX = -1;
            for (let sample = startSample; sample <= endSample; sample++) {
                if (sample >= 0 && sample < dat.length) {
                    const x = Math.floor((sample - startSample) / samplesPerPixel);
                    if (x !== lastX) {
                        let y;
                        if (isPrescaled) {
                            y = dat[sample]; // pre-scaled
                        } else {
                            y = middle + (dat[sample] * middle * 0.9);
                        }
                        ctx.lineTo(x, y);
                        lastX = x;
                    }
                }
            }
            ctx.strokeStyle = color;
            ctx.stroke();
        }
        if (showDphi) {
            doDraw(levelsData, true, 'gray');
            doDraw(data, true, 'green');
        } else {
            doDraw(data, false, 'steelblue');
        }

        if (this.message.isPlaying) {
            // Draw playback position line
            const playbackX = ((currentTime - startTime) / visibleDuration) * width;
            ctx.beginPath();
            ctx.moveTo(playbackX, 0);
            ctx.lineTo(playbackX, height);
            ctx.strokeStyle = 'red';
            ctx.stroke();
        }
    }

    toggleVisualization(add = 1) { // todo: rename cycleVisualization
        this.showMode = (this.showMode + add) % showModes.length;

        if (this.VisualizationCaption) {
            this.VisualizationCaption.innerHTML = showModes[this.showMode]['name'];
        }

        this.frameUpdate();
    }

    onPlay() {
        if (this.message == null) onStop();

        this.message.readyAudioAndBuffer();
        if (this.interval != null) return;

        this.interval = setInterval(() => {
            this.frameUpdate();

        }, 16); // Update every 16ms
    }


    onStop() {
        if (this.interval != null) clearInterval(this.interval);
        this.interval = null;
        this.frameUpdate();
    }
    onQueued() {
        this.frameUpdate();
    }

}

