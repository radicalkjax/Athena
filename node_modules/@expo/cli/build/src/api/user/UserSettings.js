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
    getSettingsDirectory: ()=>getSettingsDirectory,
    getSettingsFilePath: ()=>getSettingsFilePath,
    getSettings: ()=>getSettings,
    getAccessToken: ()=>getAccessToken,
    getSession: ()=>getSession,
    setSessionAsync: ()=>setSessionAsync,
    hasCredentials: ()=>hasCredentials,
    getAnonymousIdAsync: ()=>getAnonymousIdAsync,
    getAnonymousId: ()=>getAnonymousId
});
function _getUserState() {
    const data = require("@expo/config/build/getUserState");
    _getUserState = function() {
        return data;
    };
    return data;
}
function _jsonFile() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("@expo/json-file"));
    _jsonFile = function() {
        return data;
    };
    return data;
}
function _crypto() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("crypto"));
    _crypto = function() {
        return data;
    };
    return data;
}
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function getSettingsDirectory() {
    return (0, _getUserState().getExpoHomeDirectory)();
}
function getSettingsFilePath() {
    return (0, _getUserState().getUserStatePath)();
}
function getSettings() {
    return new (_jsonFile()).default(getSettingsFilePath(), {
        ensureDir: true,
        jsonParseErrorDefault: {},
        cantReadFileDefault: {}
    });
}
function getAccessToken() {
    return process.env.EXPO_TOKEN ?? null;
}
function getSession() {
    return getSettings().get("auth", null);
}
async function setSessionAsync(sessionData) {
    await getSettings().setAsync("auth", sessionData, {
        default: {},
        ensureDir: true
    });
}
function hasCredentials() {
    return !!getAccessToken() || !!getSession();
}
async function getAnonymousIdAsync() {
    const settings = getSettings();
    let id = await settings.getAsync("uuid", null);
    if (!id) {
        id = _crypto().default.randomUUID();
        await settings.setAsync("uuid", id);
    }
    return id;
}
function getAnonymousId() {
    const settings = getSettings();
    let id = settings.get("uuid", null);
    if (!id) {
        id = _crypto().default.randomUUID();
        settings.set("uuid", id);
    }
    return id;
}

//# sourceMappingURL=UserSettings.js.map