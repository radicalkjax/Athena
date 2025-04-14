"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _nodeFs() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("node:fs"));
    _nodeFs = function() {
        return data;
    };
    return data;
}
const _fetchClient = require("./FetchClient");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const telemetryFile = process.argv[2];
flush().catch(()=>_nodeFs().default.promises.unlink(telemetryFile)).finally(()=>process.exit(0));
async function flush() {
    if (!telemetryFile) return;
    let json;
    let data;
    try {
        json = await _nodeFs().default.promises.readFile(telemetryFile, "utf8");
        data = JSON.parse(json);
    } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
    }
    if (data.records.length) {
        const client = new _fetchClient.FetchClient();
        await client.record(data.records);
        await client.flush();
    }
    await _nodeFs().default.promises.unlink(telemetryFile);
}

//# sourceMappingURL=flushFetchDetached.js.map