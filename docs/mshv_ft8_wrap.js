import createMshvFT8Module from './mshv/mshv_ft8.js';

class MSHVFT8 {
  constructor(readyCallback) {
    createMshvFT8Module({
      locateFile: function(path, prefix) {
        if (path.endsWith('.wasm')) return './mshv/' + path;
        return prefix + path;
      }
    }).then(module => {
      this.module = module;
      this.initFT8 = this.module.cwrap('init_ft8', null, []);
      this.createInstance = this.module.cwrap('create_packunpack77_instance', 'number', ['boolean']);
      this.destroyInstance = this.module.cwrap('destroy_packunpack77_instance', null, ['number']);
      this.packFT8Message = this.module.cwrap('pack_ft8_message_safe', 'number', ['string', 'number']);
      this.unpackFT8Message = this.module.cwrap('unpack_ft8_message', 'number', ['string', 'number']);
      this.saveHashCall = this.module.cwrap('save_hash_call', null, ['string', 'number']);
      this.initFT8();
      if (readyCallback) readyCallback();
    });
  }
  
  createPackUnpackInstance(forUnpacking = true) {
    if (!this.module) throw new Error("Module not initialized");
    return this.createInstance(forUnpacking);
  }

  destroyPackUnpackInstance(instanceIndex) {
    if (!this.module) throw new Error("Module not initialized");
    this.destroyInstance(instanceIndex);
  }

  packMessage(message, instanceIndex = 0) {
    if (!this.module) throw new Error("Module not initialized");
    const resultPtr = this.packFT8Message(message, instanceIndex);
    const result = this.module.getValue(resultPtr, 'i32');
    const messagePtr = resultPtr + 4;
    const packedMessage = this.module.UTF8ToString(messagePtr);
    return { errorCode: result, message: packedMessage };
  }

  unpackMessage(packedMessage, instanceIndex = 1) {
    if (!this.module) throw new Error("Module not initialized");
    const resultPtr = this.unpackFT8Message(packedMessage, instanceIndex);
    const result = this.module.getValue(resultPtr, 'i32');
    const messagePtr = resultPtr + 4;
    const unpackedMessage = this.module.UTF8ToString(messagePtr);
    return { errorCode: result, message: unpackedMessage };
  }

  saveHash(call, instanceIndex = 1) {
    if (!this.module) throw new Error("Module not initialized");
    this.saveHashCall(call, instanceIndex);
  }
}

export default MSHVFT8;