"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "runIosAsync", {
    enumerable: true,
    get: ()=>runIosAsync
});
function _spawnAsync() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("@expo/spawn-async"));
    _spawnAsync = function() {
        return data;
    };
    return data;
}
function _chalk() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("chalk"));
    _chalk = function() {
        return data;
    };
    return data;
}
function _fs() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("fs"));
    _fs = function() {
        return data;
    };
    return data;
}
function _path() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("path"));
    _path = function() {
        return data;
    };
    return data;
}
const _log = /*#__PURE__*/ _interopRequireWildcard(require("../../log"));
const _appleAppIdResolver = require("../../start/platforms/ios/AppleAppIdResolver");
const _cocoapods = require("../../utils/cocoapods");
const _nodeEnv = require("../../utils/nodeEnv");
const _port = require("../../utils/port");
const _profile = require("../../utils/profile");
const _scheme = require("../../utils/scheme");
const _ensureNativeProject = require("../ensureNativeProject");
const _hints = require("../hints");
const _startBundler = require("../startBundler");
const _xcodeBuild = /*#__PURE__*/ _interopRequireWildcard(require("./XcodeBuild"));
const _launchApp = require("./launchApp");
const _resolveOptions = require("./options/resolveOptions");
const _validateExternalBinary = require("./validateExternalBinary");
const _exportEager = require("../../export/embed/exportEager");
const _simctl = require("../../start/platforms/ios/simctl");
const _errors = require("../../utils/errors");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interopRequireWildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const debug = require("debug")("expo:run:ios");
async function runIosAsync(projectRoot, options) {
    var ref;
    (0, _nodeEnv.setNodeEnv)(options.configuration === "Release" ? "production" : "development");
    require("@expo/env").load(projectRoot);
    assertPlatform();
    const install = !!options.install;
    if (await (0, _ensureNativeProject.ensureNativeProjectAsync)(projectRoot, {
        platform: "ios",
        install
    }) && install) {
        await (0, _cocoapods.maybePromptToSyncPodsAsync)(projectRoot);
    }
    // Resolve the CLI arguments into useable options.
    const props = await (0, _profile.profile)(_resolveOptions.resolveOptionsAsync)(projectRoot, options);
    if (options.rebundle) {
        _log.warn(`The --unstable-rebundle flag is experimental and may not work as expected.`);
        // Get the existing binary path to re-bundle the app.
        let binaryPath;
        if (!options.binary) {
            if (!props.isSimulator) {
                throw new Error("Re-bundling on physical devices requires the --binary flag.");
            }
            const appId = await new _appleAppIdResolver.AppleAppIdResolver(projectRoot).getAppIdAsync();
            const possibleBinaryPath = await (0, _simctl.getContainerPathAsync)(props.device, {
                appId
            });
            if (!possibleBinaryPath) {
                throw new _errors.CommandError(`Cannot rebundle because no --binary was provided and no existing binary was found on the device for ID: ${appId}.`);
            }
            binaryPath = possibleBinaryPath;
            _log.log("Re-using existing binary path:", binaryPath);
            // Set the binary path to the existing binary path.
            options.binary = binaryPath;
        }
        _log.log("Rebundling the Expo config file");
        // Re-bundle the config file the same way the app was originally bundled.
        await (0, _spawnAsync().default)("node", [
            _path().default.join(require.resolve("expo-constants/package.json"), "../scripts/getAppConfig.js"),
            projectRoot,
            _path().default.join(options.binary, "EXConstants.bundle"), 
        ]);
        // Re-bundle the app.
        const possibleBundleOutput = _path().default.join(options.binary, "main.jsbundle");
        if (_fs().default.existsSync(possibleBundleOutput)) {
            _log.log("Rebundling the app...");
            await (0, _exportEager.exportEagerAsync)(projectRoot, {
                resetCache: false,
                dev: false,
                platform: "ios",
                assetsDest: _path().default.join(options.binary, "assets"),
                bundleOutput: possibleBundleOutput
            });
        } else {
            _log.warn("Bundle output not found at expected location:", possibleBundleOutput);
        }
    }
    let binaryPath1;
    if (options.binary) {
        binaryPath1 = await (0, _validateExternalBinary.getValidBinaryPathAsync)(options.binary, props);
        _log.log("Using custom binary path:", binaryPath1);
    } else {
        let eagerBundleOptions;
        if (options.configuration === "Release") {
            eagerBundleOptions = JSON.stringify(await (0, _exportEager.exportEagerAsync)(projectRoot, {
                dev: false,
                platform: "ios"
            }));
        }
        // Spawn the `xcodebuild` process to create the app binary.
        const buildOutput = await _xcodeBuild.buildAsync({
            ...props,
            eagerBundleOptions
        });
        // Find the path to the built app binary, this will be used to install the binary
        // on a device.
        binaryPath1 = await (0, _profile.profile)(_xcodeBuild.getAppBinaryPath)(buildOutput);
    }
    debug("Binary path:", binaryPath1);
    // Ensure the port hasn't become busy during the build.
    if (props.shouldStartBundler && !await (0, _port.ensurePortAvailabilityAsync)(projectRoot, props)) {
        props.shouldStartBundler = false;
    }
    const launchInfo = await (0, _launchApp.getLaunchInfoForBinaryAsync)(binaryPath1);
    const isCustomBinary = !!options.binary;
    // Always close the app before launching on a simulator. Otherwise certain cached resources like the splashscreen will not be available.
    if (props.isSimulator) {
        try {
            await (0, _simctl.simctlAsync)([
                "terminate",
                props.device.udid,
                launchInfo.bundleId
            ]);
        } catch (error) {
            // If we failed it's likely that the app was not running to begin with and we will get an `invalid device` error
            debug("Failed to terminate app (possibly because it was not running):", error);
        }
    }
    // Start the dev server which creates all of the required info for
    // launching the app on a simulator.
    const manager = await (0, _startBundler.startBundlerAsync)(projectRoot, {
        port: props.port,
        headless: !props.shouldStartBundler,
        // If a scheme is specified then use that instead of the package name.
        scheme: isCustomBinary ? launchInfo.schemes[0] : (ref = await (0, _scheme.getSchemesForIosAsync)(projectRoot)) == null ? void 0 : ref[0]
    });
    // Install and launch the app binary on a device.
    await (0, _launchApp.launchAppAsync)(binaryPath1, manager, {
        isSimulator: props.isSimulator,
        device: props.device,
        shouldStartBundler: props.shouldStartBundler
    }, launchInfo.bundleId);
    // Log the location of the JS logs for the device.
    if (props.shouldStartBundler) {
        (0, _hints.logProjectLogsLocation)();
    } else {
        await manager.stopAsync();
    }
}
function assertPlatform() {
    if (process.platform !== "darwin") {
        _log.exit((0, _chalk().default)`iOS apps can only be built on macOS devices. Use {cyan eas build -p ios} to build in the cloud.`);
    }
}

//# sourceMappingURL=runIosAsync.js.map