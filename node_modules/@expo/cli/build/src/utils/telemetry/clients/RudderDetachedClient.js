"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RudderDetachedClient", {
    enumerable: true,
    get: ()=>RudderDetachedClient
});
function _nodeChildProcess() {
    const data = require("node:child_process");
    _nodeChildProcess = function() {
        return data;
    };
    return data;
}
function _nodeFs() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("node:fs"));
    _nodeFs = function() {
        return data;
    };
    return data;
}
function _nodePath() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("node:path"));
    _nodePath = function() {
        return data;
    };
    return data;
}
const _createTempPath = require("../../createTempPath");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const debug = require("debug")("expo:telemetry:client:detached");
class RudderDetachedClient {
    /** This client should be used for short-lived commands */ strategy = "detached";
    /** All recorded telemetry events */ records = [];
    abort() {
        return this.records;
    }
    record(record) {
        this.records.push(...record.map((record)=>({
                ...record,
                originalTimestamp: record.sentAt
            })));
    }
    async flush() {
        try {
            if (!this.records.length) {
                return debug("No records to flush, skipping...");
            }
            const file = (0, _createTempPath.createTempFilePath)("expo-telemetry.json");
            const data = JSON.stringify({
                records: this.records
            });
            this.records = [];
            await _nodeFs().default.promises.mkdir(_nodePath().default.dirname(file), {
                recursive: true
            });
            await _nodeFs().default.promises.writeFile(file, data);
            const child = (0, _nodeChildProcess().spawn)(process.execPath, [
                require.resolve("./flushRudderDetached"),
                file
            ], {
                detached: true,
                windowsHide: true,
                shell: false,
                stdio: "ignore"
            });
            child.unref();
        } catch (error) {
            // This could fail if any direct or indirect imports change during an upgrade to the `expo` dependency via `npx expo install --fix`,
            // since this file may no longer be present after the upgrade, but before the process under the old Expo CLI version is terminated.
            debug("Exception while initiating detached flush:", error);
        }
        debug("Detached flush started");
    }
}

//# sourceMappingURL=RudderDetachedClient.js.map