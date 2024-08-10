class PlayBtnComponent extends Component {
    constructor(index, container) {
        super(index, container); // index -2 for all messages
        this.countdownInterval = null;
        this.queuingMessage = null;
        
        this.playAudioButton = this.container.querySelector('#play-audio');
        this.playAudioTimedButton = this.container.querySelector('#play-audio-timed');
        this.stopAudioButton = this.container.querySelector('#stop-audio');
        this.downloadAudioButton = this.container.querySelector('#download-audio');
        this.countdownDiv = this.container.querySelector('#countdown');
    }

    create() {
        
        if (this.playAudioButton) this.playAudioButton.addEventListener('click', () => this.playAudioClicked() );
        if (this.playAudioTimedButton) this.playAudioTimedButton.addEventListener('click', () => this.playAudioTimedClicked());
        if (this.stopAudioButton) this.stopAudioButton.addEventListener('click', () => this.stopAudioClicked());
        if (this.downloadAudioButton) this.downloadAudioButton.addEventListener('click', () => this.downloadAudioClicked());

        console.log("PlayComponent created", this.index, this.playAudioButton, this.playAudioTimedButton, this.stopAudioButton, this.downloadAudioButton, this.countdownDiv);
    }

    /**
     * @returns {FT8Message}
     */
    getCurrentMessage() {
        return this.messageManager.getCurrentMessage() ?? this.message;
    }

    loadMessage() {
        this.message = this.getCurrentMessage(); // this.messageManager.getMessage(this.index);
        this.messageUpdate();
    }

    stopped() {
        this.updateButtonState();
    }

    frameUpdate() {
    }
    symbolUpdate() {
    }

    onPlay() {
        this.stopCountdownDisplay(); // assume it's the same message
        this.updateButtonState();
    }
    onStop() {
        this.stopCountdownDisplay();
        this.updateButtonState();
    }

    stopCountdownDisplay() {
        //TODO: check if countdown should still be going?
        if (this.countdownInterval) {
            this.queuingMessage = null;
            if (this.countdownInterval != null) clearInterval(this.countdownInterval);
            this.countdownInterval = null;
            this.countdownDiv.style.display = 'none';
        }
    }

    playAudioTimedClicked() {
        const msg = this.getCurrentMessage();
        if (msg == null) return;

        msg.queueAudio();
        this.updateButtonState();
    }

    onQueue() {
        const msg = this.getCurrentMessage();
        if (msg == null) return;

        this.stopCountdownDisplay(); // stop previous

        this.countdownDiv.style.display = 'block';
        this.queuingMessage = msg;

        function updateCountdown(playview) { // playview = this
            //const minutes = Math.floor(timeRemaining / 60);
            //const seconds = timeRemaining % 60;
            const seconds = msg?.queueTimeRemaining();
            if (seconds == null || seconds < 0) {
                playview.stopCountdownDisplay();
                //message.playAudio(); // should be done elsewhere hopefully
                return;
            }

            playview.countdownDiv.textContent = `Playing in ${seconds.toFixed(1).toString().padStart(2, '0')}`;
        }

        updateCountdown(this); // Call immediately to show correct time
        this.countdownInterval = setInterval(() => updateCountdown(this), 12); // 12ms update interval
        this.updateButtonState(); // don't do this until after countdownInterval is set (to avoid endless loop)
    }  

    messageUpdate() {
        this.stopCountdownDisplay();
        this.updateButtonState();
    }
    

    updateButtonState() {
        const msg = this.getCurrentMessage();
        const nowPlaying = this.viewManager.playingMessages;
        const anyPlaying = nowPlaying.size > 0;
        const isPlaying =  msg?.isPlaying ?? false;
        const isQueued =  msg?.queuingStartedAt != null ?? false;
        
        //console.log("updateButtonState (isPlaying, nowPlaying, nowPlaying.length):", isPlaying, nowPlaying, nowPlaying.length);

        this.playAudioButton.disabled = isPlaying;
        this.playAudioTimedButton.disabled = isPlaying || isQueued;
        this.stopAudioButton.disabled = !anyPlaying && !isQueued;
        //downloadAudioButton.disabled = isPlaying;

        if (isQueued && !this.countdownInterval) {
            this.onQueue();
        }
    }

    stopAudioClicked() {
        //const msg = this.getCurrentMessage();
        //msg?.resetAudioState();

        this.viewManager.stopAllAudio();

        this.updateButtonState();;
        this.stopCountdownDisplay();
    }

    resetAudioState(msg) {
        msg.resetAudioState();
        //updateButtonState(false);
        //this.updateButtonState();
    }

    playAudioClicked() {
        //console.log('this', this);
        //const msg = this.getCurrentMessage();

        //msg.playAudio();
        //this.viewManager.playAudioIndex(-1);
        this.viewManager.playCurrentMessageAudio();

        this.updateButtonState(); // (true)

        //listen for audio end event to update button state (don't need. already done by message's playAudio)
        //msg.audioSource.onended = () => this.updateButtonState(); 
    }

    downloadAudioClicked() {
        const msg = this.getCurrentMessage();
        msg.readyAudioAndBuffer();

        if (msg == null) return;

        if (msg.audioSamples == null) return;

        const wavData = audioBufferToWav(msg);
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const baseFreq = msg.getBaseFrequency();
        let label = '';
        if (msg.reDecodedResult?.success) label = msg.reDecodedResult.decodedText;
        if (label == null || label == '') label = msg.inputText || packedToHexStr(msg.packedData);
        const messageText = label.replace(/\s+/g, '_');
        a.download = `FT8-${Math.round(baseFreq)}Hz_${messageText}.wav`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }

}

/**
 * 
 * @param {FT8Message} msg 
 * @returns 
 */
function audioBufferToWav(msg) {
    if (msg == null || msg.audioSamples == null) return null;

    //TODO: don't require AudioBuffer, so can just use readyAudio(); 
    msg.readyAudioAndBuffer();
    //msg.readyAudio(); 

    if (msg.audioSamples == null || msg.audioBuffer == null) return null;

    const buffer = msg.audioBuffer;

    //const numChannels = 1; 
    const numChannels = buffer.numberOfChannels;
    //const sampleRate = msg.getSampleRate(); // buffer.sampleRate;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let byteRate = sampleRate * numChannels * bitDepth / 8;
    let blockAlign = numChannels * bitDepth / 8;
    //let dataSize = msg.audioSamples.length * numChannels * bitDepth / 8;
    let dataSize = buffer.length * numChannels * bitDepth / 8;

    let headerSize = 44;
    let totalSize = headerSize + dataSize;

    let arrayBuffer = new ArrayBuffer(totalSize);
    let view = new DataView(arrayBuffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // subchunk1size (16 for PCM)
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // Data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write the PCM samples
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            let sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
    }

    return arrayBuffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
