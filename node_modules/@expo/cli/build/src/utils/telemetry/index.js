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
    getTelemetry: ()=>getTelemetry,
    record: ()=>record,
    recordCommand: ()=>recordCommand
});
function _nodeProcess() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("node:process"));
    _nodeProcess = function() {
        return data;
    };
    return data;
}
const _events = require("./events");
const _user = require("../../api/user/user");
const _env = require("../env");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
/** The singleton telemetry manager to use */ let telemetry = null;
function getTelemetry() {
    if (_env.env.EXPO_NO_TELEMETRY || _env.env.EXPO_OFFLINE) return null;
    if (!telemetry) {
        // Lazy load the telemetry client, only when enabled
        const { Telemetry  } = require("./Telemetry");
        telemetry = new Telemetry();
        // Flush any pending events on exit
        _nodeProcess().default.once("SIGINT", ()=>{
            return telemetry == null ? void 0 : telemetry.flushOnExit();
        });
        _nodeProcess().default.once("SIGTERM", ()=>{
            return telemetry == null ? void 0 : telemetry.flushOnExit();
        });
        _nodeProcess().default.once("beforeExit", ()=>{
            return telemetry == null ? void 0 : telemetry.flushOnExit();
        });
        // Initialize the telemetry
        (0, _user.getUserAsync)().then((actor)=>{
            return telemetry == null ? void 0 : telemetry.initialize({
                userId: (actor == null ? void 0 : actor.id) ?? null
            });
        }).catch(()=>{
            return telemetry == null ? void 0 : telemetry.initialize({
                userId: null
            });
        });
    }
    return telemetry;
}
function record(records) {
    var ref;
    return (ref = getTelemetry()) == null ? void 0 : ref.record(records);
}
function recordCommand(command) {
    if (isLongRunningCommand(command)) {
        var ref;
        (ref = getTelemetry()) == null ? void 0 : ref.setStrategy("instant");
    }
    return record((0, _events.commandEvent)(command));
}
/** Determine if the command is a long-running command, based on the command name */ function isLongRunningCommand(command) {
    return command === "start" || command.startsWith("run") || command.startsWith("export");
}

//# sourceMappingURL=index.js.map