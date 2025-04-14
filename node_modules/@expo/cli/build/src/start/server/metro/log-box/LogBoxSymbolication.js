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
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    deleteStack: ()=>deleteStack,
    symbolicate: ()=>symbolicate,
    parseErrorStack: ()=>parseErrorStack
});
function _stacktraceParser() {
    const data = require("stacktrace-parser");
    _stacktraceParser = function() {
        return data;
    };
    return data;
}
const cache = new Map();
/**
 * Sanitize because sometimes, `symbolicateStackTrace` gives us invalid values.
 */ const sanitize = ({ stack: maybeStack , codeFrame  })=>{
    if (!Array.isArray(maybeStack)) {
        throw new Error("Expected stack to be an array.");
    }
    const stack = [];
    for (const maybeFrame of maybeStack){
        let collapse = false;
        if ("collapse" in maybeFrame) {
            if (typeof maybeFrame.collapse !== "boolean") {
                throw new Error("Expected stack frame `collapse` to be a boolean.");
            }
            collapse = maybeFrame.collapse;
        }
        stack.push({
            arguments: [],
            column: maybeFrame.column,
            file: maybeFrame.file,
            lineNumber: maybeFrame.lineNumber,
            methodName: maybeFrame.methodName,
            collapse
        });
    }
    return {
        stack,
        codeFrame
    };
};
function deleteStack(stack) {
    cache.delete(stack);
}
function symbolicate(stack) {
    let promise = cache.get(stack);
    if (promise == null) {
        promise = symbolicateStackTrace(stack).then(sanitize);
        cache.set(stack, promise);
    }
    return promise;
}
async function symbolicateStackTrace(stack) {
    const baseUrl = typeof window === "undefined" ? process.env.EXPO_DEV_SERVER_ORIGIN : window.location.protocol + "//" + window.location.host;
    return fetch(baseUrl + "/symbolicate", {
        method: "POST",
        body: JSON.stringify({
            stack
        })
    }).then((res)=>res.json());
}
function parseErrorStack(stack) {
    if (stack == null) {
        return [];
    }
    if (Array.isArray(stack)) {
        return stack;
    }
    return (0, _stacktraceParser().parse)(stack).map((frame)=>{
        // frame.file will mostly look like `http://localhost:8081/index.bundle?platform=web&dev=true&hot=false`
        return {
            ...frame,
            column: frame.column != null ? frame.column - 1 : null
        };
    });
}

//# sourceMappingURL=LogBoxSymbolication.js.map