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
    hasDirectDevClientDependency: ()=>hasDirectDevClientDependency,
    canResolveDevClient: ()=>canResolveDevClient
});
function _config() {
    const data = require("@expo/config");
    _config = function() {
        return data;
    };
    return data;
}
function _resolveFrom() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("resolve-from"));
    _resolveFrom = function() {
        return data;
    };
    return data;
}
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function hasDirectDevClientDependency(projectRoot) {
    const { dependencies ={} , devDependencies ={}  } = (0, _config().getPackageJson)(projectRoot);
    return !!dependencies["expo-dev-client"] || !!devDependencies["expo-dev-client"];
}
function canResolveDevClient(projectRoot) {
    try {
        // we check if `expo-dev-launcher` is installed instead of `expo-dev-client`
        // because someone could install only launcher.
        (0, _resolveFrom().default)(projectRoot, "expo-dev-launcher");
        return true;
    } catch  {
        return false;
    }
}

//# sourceMappingURL=detectDevClient.js.map