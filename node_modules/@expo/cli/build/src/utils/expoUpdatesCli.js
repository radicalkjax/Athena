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
    ExpoUpdatesCLIModuleNotFoundError: ()=>ExpoUpdatesCLIModuleNotFoundError,
    ExpoUpdatesCLIInvalidCommandError: ()=>ExpoUpdatesCLIInvalidCommandError,
    ExpoUpdatesCLICommandFailedError: ()=>ExpoUpdatesCLICommandFailedError,
    expoUpdatesCommandAsync: ()=>expoUpdatesCommandAsync
});
function _spawnAsync() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("@expo/spawn-async"));
    _spawnAsync = function() {
        return data;
    };
    return data;
}
function _resolveFrom() {
    const data = /*#__PURE__*/ _interopRequireWildcard(require("resolve-from"));
    _resolveFrom = function() {
        return data;
    };
    return data;
}
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
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
class ExpoUpdatesCLIModuleNotFoundError extends Error {
}
class ExpoUpdatesCLIInvalidCommandError extends Error {
}
class ExpoUpdatesCLICommandFailedError extends Error {
}
async function expoUpdatesCommandAsync(projectDir, args) {
    let expoUpdatesCli;
    try {
        expoUpdatesCli = (0, _resolveFrom().silent)(projectDir, "expo-updates/bin/cli") ?? (0, _resolveFrom().default)(projectDir, "expo-updates/bin/cli.js");
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            throw new ExpoUpdatesCLIModuleNotFoundError(`The \`expo-updates\` package was not found. `);
        }
        throw e;
    }
    try {
        return (await (0, _spawnAsync().default)(expoUpdatesCli, args, {
            stdio: "pipe",
            env: {
                ...process.env
            }
        })).stdout;
    } catch (e1) {
        if (e1.stderr && typeof e1.stderr === "string") {
            if (e1.stderr.includes("Invalid command")) {
                throw new ExpoUpdatesCLIInvalidCommandError(`The command specified by ${args} was not valid in the \`expo-updates\` CLI.`);
            } else {
                throw new ExpoUpdatesCLICommandFailedError(e1.stderr);
            }
        }
        throw e1;
    }
}

//# sourceMappingURL=expoUpdatesCli.js.map