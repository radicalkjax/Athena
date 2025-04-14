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
    fileExistsSync: ()=>fileExistsSync,
    directoryExistsSync: ()=>directoryExistsSync,
    directoryExistsAsync: ()=>directoryExistsAsync,
    fileExistsAsync: ()=>fileExistsAsync,
    ensureDirectoryAsync: ()=>ensureDirectoryAsync,
    ensureDirectory: ()=>ensureDirectory,
    copySync: ()=>copySync,
    copyAsync: ()=>copyAsync,
    removeAsync: ()=>removeAsync
});
function _fs() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("fs"));
    _fs = function() {
        return data;
    };
    return data;
}
function _fsExtra() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("fs-extra"));
    _fsExtra = function() {
        return data;
    };
    return data;
}
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function fileExistsSync(file) {
    var ref;
    return !!((ref = _fs().default.statSync(file, {
        throwIfNoEntry: false
    })) == null ? void 0 : ref.isFile());
}
function directoryExistsSync(file) {
    var ref;
    return !!((ref = _fs().default.statSync(file, {
        throwIfNoEntry: false
    })) == null ? void 0 : ref.isDirectory());
}
async function directoryExistsAsync(file) {
    var ref;
    return ((ref = await _fs().default.promises.stat(file).catch(()=>null)) == null ? void 0 : ref.isDirectory()) ?? false;
}
async function fileExistsAsync(file) {
    var ref;
    return ((ref = await _fs().default.promises.stat(file).catch(()=>null)) == null ? void 0 : ref.isFile()) ?? false;
}
const ensureDirectoryAsync = (path)=>_fs().default.promises.mkdir(path, {
        recursive: true
    });
const ensureDirectory = (path)=>_fsExtra().default.mkdirSync(path, {
        recursive: true
    });
const copySync = _fsExtra().default.copySync;
const copyAsync = _fsExtra().default.copy;
const removeAsync = _fsExtra().default.remove;

//# sourceMappingURL=dir.js.map