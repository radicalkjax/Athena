"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "pageIsSupported", {
    enumerable: true,
    get: ()=>pageIsSupported
});
function pageIsSupported(page) {
    var ref;
    // @ts-expect-error No good way to filter this properly in TypeScript
    const capabilities = page.capabilities ?? ((ref = page.reactNative) == null ? void 0 : ref.capabilities) ?? {};
    return page.title === "React Native Experimental (Improved Chrome Reloads)" || capabilities.nativePageReloads === true;
}

//# sourceMappingURL=pageIsSupported.js.map