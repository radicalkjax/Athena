"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VscodeRuntimeGetPropertiesHandler", {
    enumerable: true,
    get: ()=>VscodeRuntimeGetPropertiesHandler
});
const _messageHandler = require("../MessageHandler");
const _getDebuggerType = require("../getDebuggerType");
class VscodeRuntimeGetPropertiesHandler extends _messageHandler.MessageHandler {
    /** Keep track of `Runtime.getProperties` responses to intercept, by request id */ interceptGetProperties = new Set();
    isEnabled() {
        return (0, _getDebuggerType.getDebuggerType)(this.debugger.userAgent) === "vscode";
    }
    handleDebuggerMessage(message) {
        if (message.method === "Runtime.getProperties") {
            this.interceptGetProperties.add(message.id);
        }
        // Do not block propagation of this message
        return false;
    }
    handleDeviceMessage(message) {
        if ("id" in message && this.interceptGetProperties.has(message.id)) {
            this.interceptGetProperties.delete(message.id);
            for (const item of message.result.result ?? []){
                var ref;
                // Force-fully format the properties description to be an empty string
                if (item.value) {
                    item.value.description = item.value.description ?? "";
                }
                // Avoid passing the `objectId` for symbol types.
                // When collapsing in vscode, it will fetch information about the symbol using the `objectId`.
                // The `Runtime.getProperties` request of the symbol hard-crashes Hermes.
                if (((ref = item.value) == null ? void 0 : ref.type) === "symbol" && item.value.objectId) {
                    delete item.value.objectId;
                }
            }
        }
        // Do not block propagation of this message
        return false;
    }
}

//# sourceMappingURL=VscodeRuntimeGetProperties.js.map