class ViewManager {
    constructor() {
        this.messageManager = new MessageManager();
        this.components = [];
        this.playingMessages = new Set();
        this.queuedMessages = new Set();

        window.viewManager = this;
    }

    /**
     * 
     * @param {Component} component 
     */
    registerComponent(component) {
        this.components.push(component);
        component.messageManager = this.messageManager;
        component.viewManager = this;
        component.create();
        component.loadMessage(this.messageManager.getMessage(component.index));
    }

    getComponents(messageIndex) {
        const currentIndex = this.messageManager.currentMessageIndex;
        return this.components.filter((component) =>
            (component !== null && (
                component.index === messageIndex
                || component.index == -2 // -2 for all messages
                || (messageIndex === -99 && component.index === currentIndex) // -99 for current message
                || (component.index === -99 && messageIndex === currentIndex))));
    }

    frameUpdate() {
        this.components.forEach((component) => {
            if (component.updateOn === 'frame') {
                component.frameUpdate();
            }
        });
    }

    addMessage(message) {
        const index = this.messageManager.addMessage(message);
        if (message != null) message.viewManager = this;

        //this.messageManager.switchToMessage(index);
        return index;
    }


    addMessageAndSwitch(message) {
        const index = this.addMessage(message)
        this.switchToMessageIndex(index);
        return index;
    }

    onPlay(message) {
        this.playingMessages.add(message);
        this.queuedMessages.delete(message);
        const index = this.messageManager.getMessageIndex(message);
        if (index === -1) return;

        console.log("playing index", index, "input", message.inputText);
        this.getComponents(index).forEach((component) => {
            component.onPlay();
        });
    }

    onStop(message) {
        this.playingMessages.delete(message);
        this.queuedMessages.delete(message);
        const index = this.messageManager.getMessageIndex(message);
        this.getComponents(index).forEach((component) => {
            component.onStop();
        });
    }

    onQueue(message) {
        this.playingMessages.delete(message);
        this.queuedMessages.add(message);
        const index = this.messageManager.getMessageIndex(message);
        this.getComponents(index).forEach((component) => {
            component.onQueue();
        });
    }

    switchToMessageIndex(index) { // -1 for none; [-99 for current which is meaningless in this context]
        const oldMessage = this.messageManager.getCurrentMessage();
        this.messageManager.switchToMessageIndex(index);
        const message = this.messageManager.getMessage(index);

        this.getComponents(index).forEach((component) => {
            component.loadMessage(message); // sets .message and calls messageUpdate()
        });

        if (message != null && message.isPlaying) {
            // pass
        } else {
            this.getComponents(index).forEach((component) => {
                component.stopped();
            });
        }

        if (oldMessage != null && (message == null || oldMessage != message) && !oldMessage.isPlaying && !oldMessage.queuingStartedAt) {
            // todo: check again once old message has stopped playing
            this.deleteMessage(oldMessage);
        }

        return message;
    }

    deleteMessage(oldMessage) {
        oldMessage.clearAllCached();
         // TODO: be less aggressive with deleting messages when switching once we have a way to switch back
        this.messageManager.deleteMessage(oldMessage);
        this.playingMessages.delete(oldMessage);
        this.queuedMessages.delete(oldMessage);        
    }

    playCurrentMessageAudio() {
        //const index = this.messageManager.currentMessageIndex;
        this.playAudioIndex(-99);
    }

    playAudioIndex(index) {
        const message = this.messageManager.getMessage(index);
        if (message == null || message.isPlaying) return false;
        message.viewManager = this;
        const success = message.playAudio(); // triggers viewManager.onPlay(this);

        // triggered by message.playAudio already
        //this.views.getComponents(index).forEach((component) => { component.onPlay(); });

        return success;
    }
    
    stopAllAudio() {
        this.playingMessages.forEach((message) => {
            message.resetAudioState();
        });
        this.queuedMessages.forEach((message) => {
            message.resetAudioState();
        });
        this.playingMessages.clear();
        this.queuedMessages.clear();
    }
}


class MessageManager {
    
    constructor() {
        this.messages = [];
        this.currentMessageIndex = -1;
    }

    /**
     * @param {FT8Message} message
     * @returns {number} index
     */
    addMessage(message) {
        if (message == null) return -1;
        
        const existingIndex = this.messages.indexOf(message);
        if (existingIndex >= 0) {
            //this.currentMessageIndex = existingIndex;
            return existingIndex;
        }

        this.messages.push(message);
        const index = this.messages.length - 1;
        //this.currentMessageIndex = index;
        return index;
    }

    /**
     * @returns {FT8Message}
     */
    getCurrentMessage() {
        if (this.currentMessageIndex < 0) {
            return null;
        } else {
            return this.messages[this.currentMessageIndex];
        }
    }

    getMessageIndex(message) {
        return this.messages.indexOf(message);
    }

    deleteMessage(oldMessage) {
        let deletedAny = false;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i] === oldMessage) {
                this.messages[i] = null;
                deletedAny = true;
            }
        }
        return deletedAny;
    }

    /**
     * @param {number} index - index of message or -1 for current message
     * @returns {FT8Message}
     */
    getMessage(index) {
        if (index === -99) { // current message
            return this.getCurrentMessage();
        } else if  (index == -2) { // "all messages"; but asking for only one
            return this.getCurrentMessage();
        } else if (index < 0) {
            return null;
        } else {
            return this.messages[index];
        }
    }

    getMessages() {
        // {1: message, ... }
        // get all non-null messages, with their index
        let result = {};
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i] != null) {
                result[i] = this.messages[i];
            }
        }
        return result;
    }

    getMessageList() {
        return this.messages.filter(message => message != null);
    }

    /**
     * @param {number} index
     * @returns {FT8Message}
     */
    switchToMessageIndex(index) {
        if (index >= 0 && index < this.messages.length) {
            this.currentMessageIndex = index;
            return this.getCurrentMessage();
        } else {
            this.currentMessageIndex = -1;
            return null;
        }
    }

    deleteMessage(index) {
        if (index >= 0 && index < this.messages.length) {
            this.messages[index] = null;
            return true;
        }
        return false;
    }
}

class Component {
    constructor(index, container) {
        this.index = index;
        this.updateOn = null; // 'symbol', 'frame', 'message' // not used
        this.container = container;
        this.element = null; // not used?
        this.message = null;
        this.viewManager = null;
        this.messageManager = null;
    }

    create() {
        // To be implemented by subclasses
    }

    loadMessage() {
        //console.log("loadMessage() called on", this.constructor.name);
        this.message = this.messageManager.getMessage(this.index);
        this.messageUpdate();
    }

    loadMessage(message) {
        // called after creation or when message data changes
        //console.log("loadMessage(message) called on", this.constructor.name);
        this.message = message;
        this.messageUpdate();
    }

    stopped() {
    }

    messageUpdate() {
    }
    frameUpdate() {
    }
    symbolUpdate() {
    }

    onPlay() {
    }
    onStop() {
    }
    onQueue() {
    }  

    setVisible(visible) {
        if (this.element) {
            this.element.style.display = visible ? 'block' : 'none';
        }
    }

    dispose() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

export { ViewManager, Component, MessageManager };