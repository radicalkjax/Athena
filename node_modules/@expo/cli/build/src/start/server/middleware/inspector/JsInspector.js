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
    openJsInspector: ()=>openJsInspector,
    queryInspectorAppAsync: ()=>queryInspectorAppAsync,
    queryAllInspectorAppsAsync: ()=>queryAllInspectorAppsAsync,
    promptInspectorAppAsync: ()=>promptInspectorAppAsync
});
function _chalk() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("chalk"));
    _chalk = function() {
        return data;
    };
    return data;
}
const _cdpClient = require("./CdpClient");
const _prompts = require("../../../../utils/prompts");
const _pageIsSupported = require("../../metro/debugging/pageIsSupported");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const debug = require("debug")("expo:start:server:middleware:inspector:jsInspector");
async function openJsInspector(metroBaseUrl, app) {
    var ref;
    if (!((ref = app.reactNative) == null ? void 0 : ref.logicalDeviceId)) {
        debug("Failed to open React Native DevTools, target is missing device ID");
        return false;
    }
    const url = new URL("/open-debugger", metroBaseUrl);
    url.searchParams.set("appId", app.description);
    url.searchParams.set("device", app.reactNative.logicalDeviceId);
    url.searchParams.set("target", app.id);
    // Request to open the React Native DevTools, but limit it to 1s
    // This is a workaround as this endpoint might not respond on some devices
    const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(1000)
    }).catch((error)=>{
        // Only swallow timeout errors
        if (error.name === "TimeoutError") {
            return null;
        }
        throw error;
    });
    if (!response) {
        debug(`No response received from the React Native DevTools.`);
    } else if (response.ok === false) {
        debug("Failed to open React Native DevTools, received response:", response.status);
    }
    return (response == null ? void 0 : response.ok) ?? true;
}
async function queryInspectorAppAsync(metroServerOrigin, appId) {
    const apps = await queryAllInspectorAppsAsync(metroServerOrigin);
    return apps.find((app)=>app.description === appId) ?? null;
}
async function queryAllInspectorAppsAsync(metroServerOrigin) {
    const resp = await fetch(`${metroServerOrigin}/json/list`);
    const apps = transformApps(await resp.json());
    const results = [];
    for (const app of apps){
        // Only use targets with better reloading support
        if (!(0, _pageIsSupported.pageIsSupported)(app)) {
            continue;
        }
        // Hide targets that are marked as hidden from the inspector, e.g. instances from expo-dev-menu and expo-dev-launcher.
        if (await appShouldBeIgnoredAsync(app)) {
            continue;
        }
        results.push(app);
    }
    return results;
}
async function promptInspectorAppAsync(apps) {
    var ref;
    if (apps.length === 1) {
        return apps[0];
    }
    // Check if multiple devices are connected with the same device names
    // In this case, append the actual app id (device ID + page number) to the prompt
    const hasDuplicateNames = apps.some((app, index)=>index !== apps.findIndex((other)=>app.deviceName === other.deviceName));
    const choices = apps.map((app)=>{
        const name = app.deviceName ?? "Unknown device";
        return {
            title: hasDuplicateNames ? (0, _chalk().default)`${name}{dim  - ${app.id}}` : name,
            value: app.id,
            app
        };
    });
    const value = await (0, _prompts.selectAsync)((0, _chalk().default)`Debug target {dim (Hermes only)}`, choices);
    return (ref = choices.find((item)=>item.value === value)) == null ? void 0 : ref.app;
}
// The description of `React Native Experimental (Improved Chrome Reloads)` target is `don't use` from metro.
// This function tries to transform the unmeaningful description to appId
function transformApps(apps) {
    const deviceIdToAppId = {};
    for (const app of apps){
        if (app.description !== "don't use") {
            var ref;
            const deviceId = ((ref = app.reactNative) == null ? void 0 : ref.logicalDeviceId) ?? app.id.split("-")[0];
            const appId = app.description;
            deviceIdToAppId[deviceId] = appId;
        }
    }
    return apps.map((app)=>{
        if (app.description === "don't use") {
            var ref;
            const deviceId = ((ref = app.reactNative) == null ? void 0 : ref.logicalDeviceId) ?? app.id.split("-")[0];
            app.description = deviceIdToAppId[deviceId] ?? app.description;
        }
        return app;
    });
}
const HIDE_FROM_INSPECTOR_ENV = "globalThis.__expo_hide_from_inspector__";
async function appShouldBeIgnoredAsync(app) {
    const hideFromInspector = await (0, _cdpClient.evaluateJsFromCdpAsync)(app.webSocketDebuggerUrl, HIDE_FROM_INSPECTOR_ENV);
    debug(`[appShouldBeIgnoredAsync] webSocketDebuggerUrl[${app.webSocketDebuggerUrl}] hideFromInspector[${hideFromInspector}]`);
    return hideFromInspector !== undefined;
}

//# sourceMappingURL=JsInspector.js.map