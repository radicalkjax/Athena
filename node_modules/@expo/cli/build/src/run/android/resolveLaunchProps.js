"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "resolveLaunchPropsAsync", {
    enumerable: true,
    get: ()=>resolveLaunchPropsAsync
});
function _configPlugins() {
    const data = require("@expo/config-plugins");
    _configPlugins = function() {
        return data;
    };
    return data;
}
const _androidAppIdResolver = require("../../start/platforms/android/AndroidAppIdResolver");
const _errors = require("../../utils/errors");
async function getMainActivityAsync(projectRoot) {
    const filePath = await _configPlugins().AndroidConfig.Paths.getAndroidManifestAsync(projectRoot);
    const androidManifest = await _configPlugins().AndroidConfig.Manifest.readAndroidManifestAsync(filePath);
    // Assert MainActivity defined.
    const activity = await _configPlugins().AndroidConfig.Manifest.getRunnableActivity(androidManifest);
    if (!activity) {
        throw new _errors.CommandError("ANDROID_MALFORMED", `${filePath} is missing a runnable activity element.`);
    }
    // Often this is ".MainActivity"
    return activity.$["android:name"];
}
async function resolveLaunchPropsAsync(projectRoot, options) {
    const mainActivity = await getMainActivityAsync(projectRoot);
    const packageName = await new _androidAppIdResolver.AndroidAppIdResolver(projectRoot).getAppIdFromNativeAsync();
    const customAppId = options.appId;
    const launchActivity = customAppId && customAppId !== packageName ? `${customAppId}/${packageName}${mainActivity}` : `${packageName}/${mainActivity}`;
    return {
        mainActivity,
        launchActivity,
        packageName,
        customAppId
    };
}

//# sourceMappingURL=resolveLaunchProps.js.map