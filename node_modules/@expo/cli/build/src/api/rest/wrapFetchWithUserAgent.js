"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "wrapFetchWithUserAgent", {
    enumerable: true,
    get: ()=>wrapFetchWithUserAgent
});
function _nodeProcess() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("node:process"));
    _nodeProcess = function() {
        return data;
    };
    return data;
}
const _fetch = require("../../utils/fetch");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function wrapFetchWithUserAgent(fetch) {
    return (url, init = {})=>{
        const headers = new _fetch.Headers(init.headers);
        // Version is added in the build script
        headers.append("User-Agent", `expo-cli/${_nodeProcess().default.env.__EXPO_VERSION}`);
        init.headers = headers;
        return fetch(url, init);
    };
}

//# sourceMappingURL=wrapFetchWithUserAgent.js.map