/**
 * Copyright (c) 650 Industries.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LogBoxLog", {
    enumerable: true,
    get: ()=>LogBoxLog
});
const _logBoxSymbolication = /*#__PURE__*/ _interopRequireWildcard(require("./LogBoxSymbolication"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interopRequireWildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function componentStackToStack(componentStack) {
    return componentStack.map((stack)=>{
        var ref, ref1;
        return {
            file: stack.fileName,
            methodName: stack.content,
            lineNumber: ((ref = stack.location) == null ? void 0 : ref.row) ?? 0,
            column: ((ref1 = stack.location) == null ? void 0 : ref1.column) ?? 0,
            arguments: []
        };
    });
}
class LogBoxLog {
    symbolicated = {
        stack: {
            error: null,
            stack: null,
            status: "NONE"
        },
        component: {
            error: null,
            stack: null,
            status: "NONE"
        }
    };
    callbacks = new Map();
    constructor(data){
        this.level = data.level;
        this.type = data.type ?? "error";
        this.message = data.message;
        this.stack = data.stack;
        this.category = data.category;
        this.componentStack = data.componentStack;
        this.codeFrame = data.codeFrame;
        this.isComponentError = data.isComponentError;
        this.count = 1;
        this.symbolicated = data.symbolicated ?? this.symbolicated;
    }
    incrementCount() {
        this.count += 1;
    }
    getAvailableStack(type) {
        if (this.symbolicated[type].status === "COMPLETE") {
            return this.symbolicated[type].stack;
        }
        return this.getStack(type);
    }
    flushCallbacks(type) {
        const callbacks = this.callbacks.get(type);
        const status = this.symbolicated[type].status;
        if (callbacks) {
            for (const callback of callbacks){
                callback(status);
            }
            callbacks.clear();
        }
    }
    pushCallback(type, callback) {
        let callbacks = this.callbacks.get(type);
        if (!callbacks) {
            callbacks = new Set();
            this.callbacks.set(type, callbacks);
        }
        callbacks.add(callback);
    }
    retrySymbolicate(type, callback) {
        this._symbolicate(type, true, callback);
    }
    symbolicate(type, callback) {
        this._symbolicate(type, false, callback);
    }
    _symbolicate(type, retry, callback) {
        if (callback) {
            this.pushCallback(type, callback);
        }
        const status = this.symbolicated[type].status;
        if (status === "COMPLETE") {
            return this.flushCallbacks(type);
        }
        if (retry) {
            _logBoxSymbolication.deleteStack(this.getStack(type));
            this.handleSymbolicate(type);
        } else {
            if (status === "NONE") {
                this.handleSymbolicate(type);
            }
        }
    }
    componentStackCache = null;
    getStack(type) {
        if (type === "component") {
            if (this.componentStackCache == null) {
                this.componentStackCache = componentStackToStack(this.componentStack);
            }
            return this.componentStackCache;
        }
        return this.stack;
    }
    handleSymbolicate(type) {
        var ref;
        if (type === "component" && !((ref = this.componentStack) == null ? void 0 : ref.length)) {
            return;
        }
        if (this.symbolicated[type].status !== "PENDING") {
            this.updateStatus(type, null, null, null);
            _logBoxSymbolication.symbolicate(this.getStack(type)).then((data)=>{
                this.updateStatus(type, null, data == null ? void 0 : data.stack, data == null ? void 0 : data.codeFrame);
            }, (error)=>{
                this.updateStatus(type, error, null, null);
            });
        }
    }
    updateStatus(type, error, stack, codeFrame) {
        const lastStatus = this.symbolicated[type].status;
        if (error != null) {
            this.symbolicated[type] = {
                error,
                stack: null,
                status: "FAILED"
            };
        } else if (stack != null) {
            if (codeFrame) {
                this.codeFrame = codeFrame;
            }
            this.symbolicated[type] = {
                error: null,
                stack,
                status: "COMPLETE"
            };
        } else {
            this.symbolicated[type] = {
                error: null,
                stack: null,
                status: "PENDING"
            };
        }
        const status = this.symbolicated[type].status;
        if (lastStatus !== status) {
            if ([
                "COMPLETE",
                "FAILED"
            ].includes(status)) {
                this.flushCallbacks(type);
            }
        }
    }
}

//# sourceMappingURL=LogBoxLog.js.map