"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RudderClient", {
    enumerable: true,
    get: ()=>RudderClient
});
function _rudderSdkNode() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("@expo/rudder-sdk-node"));
    _rudderSdkNode = function() {
        return data;
    };
    return data;
}
const _constants = require("../utils/constants");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class RudderClient {
    /** This client should only be used in debug mode, or in the detached script */ strategy = "debug";
    constructor(sdk){
        if (!sdk) {
            sdk = new (_rudderSdkNode()).default(_constants.TELEMETRY_TARGET, _constants.TELEMETRY_ENDPOINT, {
                flushInterval: 300
            });
        }
        this.rudderstack = sdk;
    }
    abort() {
        throw new Error("Cannot abort Rudderstack client records");
    }
    async record(records) {
        await Promise.all(records.map((record)=>this.rudderstack.track(record)));
    }
    async flush() {
        await this.rudderstack.flush();
    }
}

//# sourceMappingURL=RudderClient.js.map