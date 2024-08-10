class PianoRollComponent extends Component {
    create() {
        //this.container = document.container.getElementById('piano-roll');
        //window.addEventListener('resize', this.handleResize);

        this.interval = null;
    }
    
    messageUpdate() {    
        //console.log("piano roll: messageUpdate");
        //const div = document.getElementById('piano-roll');
        const div = this.container;
        div.innerHTML = '';

        if (this.message == null || this.message.symbolsText == null) {
            //console.log("piano roll: no message/symbols. Message:", this.message?.symbolsText);
            return;
        }

        const symbols = Array.from(this.message.symbolsText);
        div.style.gridTemplateColumns = `repeat(${symbols.length}, 1fr)`;

        //console.log('symbols', symbols);

        symbols.forEach((symbol, index) => {
            if (symbol === '-') return;
            const symbolDiv = document.createElement('div');
            symbolDiv.style.backgroundColor = this.getSymbolBackgroundColor(index);
            symbolDiv.style.gridRow = `${8 - symbol} / span 1`;
            symbolDiv.style.gridColumn = `${index + 1} / span 1`;
            symbolDiv.dataset.index = index;
            symbolDiv.dataset.symbol = symbol;
            div.appendChild(symbolDiv);
        });
        
        //position line
        this.positionLine = document.createElement('div');
        this.positionLine.id = 'position-line';
        this.positionLine.style.backgroundColor = 'var(--position-line-color)'; //document.body.classList.contains('dark-mode') ? 'white' : 'red';
        this.positionLine.style.display = 'none'; // Initially hidden
        this.positionLine.dataset.index = -999;
        this.positionLine.dataset.symbol = '|';
        div.appendChild(this.positionLine);

        //console.log("piano roll: done updating");
    }

    getSymbolBackgroundColor(index) {
        return 'var(--data-bg)';
    }

    getHighlightColor(index, symbol) {
        if (this.isCostasSymbol(index)) {
            return 'var(--costas-bg)';
        }

        const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#ff6b6b', '#ff6b6b'];
        const colors2 = ['#d0e11b', '#ffaa33'];
        if (typeof symbol === 'string' && !isNaN(symbol)) {
            symbol = parseInt(symbol);
        }
        return colors2[symbol % colors2.length];
        //return colors[symbol];
    }

    isCostasSymbol(index) {
        const costasIndices = [0, 1, 2, 3, 4, 5, 6, 36, 37, 38, 39, 40, 41, 42, 72, 73, 74, 75, 76, 77, 78];
        return costasIndices.includes(index);
    }

    onPlay() {
        console.log('piano playing');

        if (this.message == null) return;

        this.message.readyAudioAndBuffer();

        // Show position line
        //const positionLine = document.getElementById('position-line');
        if (this.positionLine != null) {
            this.positionLine.style.display = 'block';
            this.positionLine.style.backgroundColor = 'var(--position-line-color)';
        }

        this.interval = setInterval(() => {
            //const currentTime = this.message.audioContext.currentTime - this.message.startTime;
            if (this.message == null) return;

            const timing = this.message?.getTiming();
            const currentTime = timing?.currentTime;
            //console.log('piano timing', timing);

            if (currentTime == null || !timing.isPlaying) return; // todo: or clear?

            this.highlightCurrentSymbol(timing);

        }, 50); // Update every 50ms
    }

    onStop() {
        clearInterval(this.interval);

        // Clear all highlights
        if (this.container) {
            const symbols = this.container.children;
            for (let i = 0; i < symbols.length; i++) {
                const symbolChar = symbols[i].dataset.symbol;
                if (symbolChar === '|') {
                    //continue;
                } else if (symbolChar === '-') {
                    symbols[i].style.display = 'none';
                } else {
                    symbols[i].style.backgroundColor = this.getSymbolBackgroundColor(i);
                }
            }
        }

        // Hide position line
        //const positionLine = document.getElementById('position-line');
        if (this.positionLine != null) {
            this.positionLine.style.display = 'none';
        }
        
    }

    highlightCurrentSymbol(timing) {
        const msg = this.message; //messageManager.getCurrentMessage();
        if (msg == null) return;

        const currentSymbolIndex = timing.currentSymbolIndex;
        
        const div = this.container; //document.getElementById('piano-roll');
        const symbols = div.children;
        //const positionLine = this.positionLine; //document.getElementById('position-line');
        //console.log('symbols.length', symbols.length, 'current symbol index', currentSymbolIndex, timing);

        for (let i = 0; i < symbols.length; i++) {
            let v = symbols[i].dataset.index;
            const symbol = symbols[i].dataset.symbol;

            if (symbol == '|') continue; // position line, skip. (not a symbol block)

            if (typeof v === 'string' && !isNaN(v)) {
                v = parseInt(v);
            }
            //console.log('v', v, 'currentSymbolIndex', currentSymbolIndex);
            if (v === currentSymbolIndex) {
                symbols[i].style.backgroundColor = this.getHighlightColor(i, symbol);
            } else {
                symbols[i].style.backgroundColor = this.getSymbolBackgroundColor(i);
            }
        }

        // Update position line
        if (this.positionLine != null) {
            this.positionLine.style.left = `${timing.progress.toFixed(3)}%`;
        }
    }

    initialUpdate() {
    }

    handleResize() {
    }

    frameUpdate() {

    }

}

