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
    createTempDirectoryPath: ()=>createTempDirectoryPath,
    createTempFilePath: ()=>createTempFilePath
});
function _fs() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("fs"));
    _fs = function() {
        return data;
    };
    return data;
}
function _path() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("path"));
    _path = function() {
        return data;
    };
    return data;
}
function _tempDir() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("temp-dir"));
    _tempDir = function() {
        return data;
    };
    return data;
}
function _uniqueString() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("unique-string"));
    _uniqueString = function() {
        return data;
    };
    return data;
}
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const uniqueTempPath = ()=>_path().default.join(_tempDir().default, (0, _uniqueString().default)());
function createTempDirectoryPath() {
    const directory = uniqueTempPath();
    _fs().default.mkdirSync(directory);
    return directory;
}
function createTempFilePath(name = "") {
    if (name) {
        return _path().default.join(createTempDirectoryPath(), name);
    } else {
        return uniqueTempPath();
    }
}

//# sourceMappingURL=createTempPath.js.map