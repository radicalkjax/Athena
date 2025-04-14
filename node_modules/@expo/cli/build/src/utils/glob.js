"use strict";
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
    everyMatchAsync: ()=>everyMatchAsync,
    anyMatchAsync: ()=>anyMatchAsync
});
function _glob() {
    const data = require("glob");
    _glob = function() {
        return data;
    };
    return data;
}
const everyMatchAsync = _glob().glob;
function anyMatchAsync(pattern, options) {
    return new Promise((resolve, reject)=>{
        const controller = new AbortController();
        (0, _glob().globStream)(pattern, {
            ...options,
            signal: controller.signal
        }).on("error", (error)=>{
            if (!controller.signal.aborted) {
                reject(error);
            }
        }).once("end", ()=>resolve([])).once("data", (file)=>{
            controller.abort();
            resolve([
                file
            ]);
        });
    });
}

//# sourceMappingURL=glob.js.map