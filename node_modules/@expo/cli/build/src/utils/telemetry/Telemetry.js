"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Telemetry", {
    enumerable: true,
    get: ()=>Telemetry
});
function _nodeCrypto() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("node:crypto"));
    _nodeCrypto = function() {
        return data;
    };
    return data;
}
const _fetchClient = require("./clients/FetchClient");
const _fetchDetachedClient = require("./clients/FetchDetachedClient");
const _context = require("./utils/context");
const _userSettings = require("../../api/user/UserSettings");
const _env = require("../env");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const debug = require("debug")("expo:telemetry");
class Telemetry {
    context = (0, _context.createContext)();
    client = new _fetchDetachedClient.FetchDetachedClient();
    /** A list of all events, recorded before the telemetry was fully initialized */ earlyRecords = [];
    constructor({ anonymousId =(0, _userSettings.getAnonymousId)() , sessionId =_nodeCrypto().default.randomUUID() , userId , strategy ="detached"  } = {}){
        this.actor = {
            anonymousId,
            sessionId
        };
        this.setStrategy(_env.env.EXPO_NO_TELEMETRY_DETACH ? "debug" : strategy);
        if (userId) {
            this.initialize({
                userId
            });
        }
    }
    get strategy() {
        return this.client.strategy;
    }
    setStrategy(strategy) {
        // Abort when client is already using the correct strategy
        if (this.client.strategy === strategy) return;
        // Abort when debugging the telemetry
        if (_env.env.EXPO_NO_TELEMETRY_DETACH && strategy !== "debug") return;
        debug("Switching strategy from %s to %s", this.client.strategy, strategy);
        // Load and instantiate the correct client, based on strategy
        const client = createClientFromStrategy(strategy);
        // Replace the client, and re-record any pending records
        this.client.abort().forEach((record)=>client.record([
                record
            ]));
        this.client = client;
        return this;
    }
    get isInitialized() {
        return this.actor.userHash !== undefined;
    }
    initialize({ userId  }) {
        this.actor.userHash = userId ? hashUserId(userId) : null;
        this.flushEarlyRecords();
    }
    flushEarlyRecords() {
        if (this.earlyRecords.length) {
            this.recordInternal(this.earlyRecords);
            this.earlyRecords = [];
        }
    }
    recordInternal(records) {
        return this.client.record(records.map((record)=>({
                ...record,
                type: "track",
                sentAt: new Date(),
                messageId: createMessageId(record),
                anonymousId: this.actor.anonymousId,
                userHash: this.actor.userHash,
                context: {
                    ...this.context,
                    sessionId: this.actor.sessionId,
                    client: {
                        mode: this.client.strategy
                    }
                }
            })));
    }
    record(record) {
        const records = Array.isArray(record) ? record : [
            record
        ];
        debug("Recording %d event(s)", records.length);
        if (!this.isInitialized) {
            this.earlyRecords.push(...records);
            return;
        }
        return this.recordInternal(records);
    }
    flush() {
        debug("Flushing events...");
        this.flushEarlyRecords();
        return this.client.flush();
    }
    flushOnExit() {
        this.setStrategy("detached");
        this.flushEarlyRecords();
        return this.client.flush();
    }
}
function createClientFromStrategy(strategy) {
    // When debugging, use the actual Rudderstack client, but lazy load it
    if (_env.env.EXPO_NO_TELEMETRY_DETACH || strategy === "debug" || strategy === "instant") {
        return new _fetchClient.FetchClient();
    }
    return new _fetchDetachedClient.FetchDetachedClient();
}
/** Generate a unique message ID using a random hash and UUID */ function createMessageId(record) {
    const uuid = _nodeCrypto().default.randomUUID();
    const md5 = _nodeCrypto().default.createHash("md5").update(JSON.stringify(record)).digest("hex");
    return `node-${md5}-${uuid}`;
}
/** Hash the user identifier to make it untracable */ function hashUserId(userId) {
    return _nodeCrypto().default.createHash("sha256").update(userId).digest("hex");
}

//# sourceMappingURL=Telemetry.js.map