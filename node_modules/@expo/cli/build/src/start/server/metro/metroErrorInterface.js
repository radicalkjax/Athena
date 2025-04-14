/**
 * Copyright © 2022 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
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
    logMetroErrorWithStack: ()=>logMetroErrorWithStack,
    IS_METRO_BUNDLE_ERROR_SYMBOL: ()=>IS_METRO_BUNDLE_ERROR_SYMBOL,
    logMetroError: ()=>logMetroError,
    logMetroErrorAsync: ()=>logMetroErrorAsync,
    getErrorOverlayHtmlAsync: ()=>getErrorOverlayHtmlAsync
});
function _paths() {
    const data = require("@expo/config/paths");
    _paths = function() {
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
function _path() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("path"));
    _path = function() {
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
function _stacktraceParser() {
    const data = require("stacktrace-parser");
    _stacktraceParser = function() {
        return data;
    };
    return data;
}
function _terminalLink() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("terminal-link"));
    _terminalLink = function() {
        return data;
    };
    return data;
}
const _logBoxLog = require("./log-box/LogBoxLog");
const _formatProjectFilePath = require("./log-box/formatProjectFilePath");
const _log = require("../../../log");
const _ansi = require("../../../utils/ansi");
const _errors = require("../../../utils/errors");
const _getStaticRenderFunctions = require("../getStaticRenderFunctions");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function fill(width) {
    return Array(width).join(" ");
}
function formatPaths(config) {
    const filePath = _chalk().default.reset(config.filePath);
    return _chalk().default.dim("(") + filePath + _chalk().default.dim(`:${[
        config.line,
        config.col
    ].filter(Boolean).join(":")})`);
}
async function logMetroErrorWithStack(projectRoot, { stack , codeFrame , error  }) {
    if (error instanceof _errors.SilentError) {
        return;
    }
    // process.stdout.write('\u001b[0m'); // Reset attributes
    // process.stdout.write('\u001bc'); // Reset the terminal
    _log.Log.log();
    _log.Log.log(_chalk().default.red("Metro error: ") + error.message);
    _log.Log.log();
    if (error instanceof _errors.CommandError) {
        return;
    }
    if (codeFrame) {
        var ref;
        const maxWarningLineLength = Math.max(200, process.stdout.columns);
        const lineText = codeFrame.content;
        const isPreviewTooLong = codeFrame.content.split("\n").some((line)=>line.length > maxWarningLineLength);
        const column = (ref = codeFrame.location) == null ? void 0 : ref.column;
        // When the preview is too long, we skip reading the file and attempting to apply
        // code coloring, this is because it can get very slow.
        if (isPreviewTooLong) {
            var ref1, ref2;
            let previewLine = "";
            let cursorLine = "";
            const formattedPath = formatPaths({
                filePath: codeFrame.fileName,
                line: (ref1 = codeFrame.location) == null ? void 0 : ref1.row,
                col: (ref2 = codeFrame.location) == null ? void 0 : ref2.column
            });
            // Create a curtailed preview line like:
            // `...transition:'fade'},k._updatePropsStack=function(){clearImmediate(k._updateImmediate),k._updateImmediate...`
            // If there is no text preview or column number, we can't do anything.
            if (lineText && column != null) {
                var ref3;
                const rangeWindow = Math.round(Math.max(((ref3 = codeFrame.fileName) == null ? void 0 : ref3.length) ?? 0, Math.max(80, process.stdout.columns)) / 2);
                let minBounds = Math.max(0, column - rangeWindow);
                const maxBounds = Math.min(minBounds + rangeWindow * 2, lineText.length);
                previewLine = lineText.slice(minBounds, maxBounds);
                // If we splice content off the start, then we should append `...`.
                // This is unlikely to happen since we limit the activation size.
                if (minBounds > 0) {
                    // Adjust the min bounds so the cursor is aligned after we add the "..."
                    minBounds -= 3;
                    previewLine = _chalk().default.dim("...") + previewLine;
                }
                if (maxBounds < lineText.length) {
                    previewLine += _chalk().default.dim("...");
                }
                // If the column property could be found, then use that to fix the cursor location which is often broken in regex.
                cursorLine = (column == null ? "" : fill(column) + _chalk().default.reset("^")).slice(minBounds);
                _log.Log.log([
                    formattedPath,
                    "",
                    previewLine,
                    cursorLine,
                    _chalk().default.dim("(error truncated)")
                ].join("\n"));
            }
        } else {
            _log.Log.log(codeFrame.content);
        }
    }
    if (stack == null ? void 0 : stack.length) {
        const stackProps = stack.map((frame)=>{
            return {
                title: frame.methodName,
                subtitle: (0, _formatProjectFilePath.getStackFormattedLocation)(projectRoot, frame),
                collapse: frame.collapse
            };
        });
        const stackLines = [];
        stackProps.forEach((frame)=>{
            const position = _terminalLink().default.isSupported ? (0, _terminalLink().default)(frame.subtitle, frame.subtitle) : frame.subtitle;
            let lineItem = _chalk().default.gray(`  ${frame.title} (${position})`);
            if (frame.collapse) {
                lineItem = _chalk().default.dim(lineItem);
            }
            // Never show the internal module system.
            if (!frame.subtitle.match(/\/metro-require\/require\.js/)) {
                stackLines.push(lineItem);
            }
        });
        _log.Log.log();
        _log.Log.log(_chalk().default.bold`Call Stack`);
        if (!stackLines.length) {
            _log.Log.log(_chalk().default.gray("  No stack trace available."));
        } else {
            _log.Log.log(stackLines.join("\n"));
        }
    } else {
        _log.Log.log(_chalk().default.gray(`  ${error.stack}`));
    }
}
const IS_METRO_BUNDLE_ERROR_SYMBOL = Symbol("_isMetroBundleError");
const HAS_LOGGED_SYMBOL = Symbol("_hasLoggedInCLI");
async function logMetroError(projectRoot, { error  }) {
    var ref, ref1;
    if (error instanceof _errors.SilentError || error[HAS_LOGGED_SYMBOL]) {
        return;
    }
    error[HAS_LOGGED_SYMBOL] = true;
    const stack = parseErrorStack(projectRoot, error.stack);
    const log = new _logBoxLog.LogBoxLog({
        level: "static",
        message: {
            content: error.message,
            substitutions: []
        },
        isComponentError: false,
        stack,
        category: "static",
        componentStack: []
    });
    await new Promise((res)=>log.symbolicate("stack", res));
    logMetroErrorWithStack(projectRoot, {
        stack: ((ref = log.symbolicated) == null ? void 0 : (ref1 = ref.stack) == null ? void 0 : ref1.stack) ?? [],
        codeFrame: log.codeFrame,
        error
    });
}
function isTransformError(error) {
    return error.type === "TransformError";
}
/** @returns the html required to render the static metro error as an SPA. */ function logFromError({ error , projectRoot  }) {
    // Remap direct Metro Node.js errors to a format that will appear more client-friendly in the logbox UI.
    let stack;
    if (isTransformError(error) && error.filename) {
        // Syntax errors in static rendering.
        stack = [
            {
                file: _path().default.join(projectRoot, error.filename),
                methodName: "<unknown>",
                arguments: [],
                // TODO: Import stack
                lineNumber: error.lineNumber,
                column: error.column
            }, 
        ];
    } else if ("originModulePath" in error && typeof error.originModulePath === "string") {
        // TODO: Use import stack here when the error is resolution based.
        stack = [
            {
                file: error.originModulePath,
                methodName: "<unknown>",
                arguments: [],
                // TODO: Import stack
                lineNumber: 0,
                column: 0
            }, 
        ];
    } else {
        stack = parseErrorStack(projectRoot, error.stack);
    }
    return new _logBoxLog.LogBoxLog({
        level: "static",
        message: {
            content: error.message,
            substitutions: []
        },
        isComponentError: false,
        stack,
        category: "static",
        componentStack: []
    });
}
async function logMetroErrorAsync({ error , projectRoot  }) {
    var ref, ref1;
    const log = logFromError({
        projectRoot,
        error
    });
    await new Promise((res)=>log.symbolicate("stack", ()=>res()));
    logMetroErrorWithStack(projectRoot, {
        stack: ((ref = log.symbolicated) == null ? void 0 : (ref1 = ref.stack) == null ? void 0 : ref1.stack) ?? [],
        codeFrame: log.codeFrame,
        error
    });
}
async function getErrorOverlayHtmlAsync({ error , projectRoot , routerRoot  }) {
    var ref, ref1;
    const log = logFromError({
        projectRoot,
        error
    });
    await new Promise((res)=>log.symbolicate("stack", ()=>res()));
    logMetroErrorWithStack(projectRoot, {
        stack: ((ref = log.symbolicated) == null ? void 0 : (ref1 = ref.stack) == null ? void 0 : ref1.stack) ?? [],
        codeFrame: log.codeFrame,
        error
    });
    if ("message" in log && "content" in log.message && typeof log.message.content === "string") {
        log.message.content = (0, _ansi.stripAnsi)(log.message.content);
    }
    const logBoxContext = {
        selectedLogIndex: 0,
        isDisabled: false,
        logs: [
            log
        ]
    };
    const html = `<html><head><style>#root,body,html{height:100%}body{overflow:hidden}#root{display:flex}</style></head><body><div id="root"></div><script id="_expo-static-error" type="application/json">${JSON.stringify(logBoxContext)}</script></body></html>`;
    const errorOverlayEntry = await (0, _getStaticRenderFunctions.createMetroEndpointAsync)(projectRoot, // Keep the URL relative
    "", (0, _resolveFrom().default)(projectRoot, "expo-router/_error"), {
        mode: "development",
        platform: "web",
        minify: false,
        optimize: false,
        usedExports: false,
        baseUrl: "",
        routerRoot,
        isExporting: false,
        reactCompiler: false
    });
    const htmlWithJs = html.replace("</body>", `<script src=${errorOverlayEntry}></script></body>`);
    return htmlWithJs;
}
function parseErrorStack(projectRoot, stack) {
    if (stack == null) {
        return [];
    }
    if (Array.isArray(stack)) {
        return stack;
    }
    const serverRoot = (0, _paths().getMetroServerRoot)(projectRoot);
    return (0, _stacktraceParser().parse)(stack).map((frame)=>{
        // frame.file will mostly look like `http://localhost:8081/index.bundle?platform=web&dev=true&hot=false`
        if (frame.file) {
            // SSR will sometimes have absolute paths followed by `.bundle?...`, we need to try and make them relative paths and append a dev server URL.
            if (frame.file.startsWith("/") && frame.file.includes("bundle?") && !canParse(frame.file)) {
                // Malformed stack file from SSR. Attempt to repair.
                frame.file = "https://localhost:8081/" + _path().default.relative(serverRoot, frame.file);
            }
        }
        return {
            ...frame,
            column: frame.column != null ? frame.column - 1 : null
        };
    }).filter((frame)=>frame.file && !frame.file.includes("node_modules"));
}
function canParse(url) {
    try {
        // eslint-disable-next-line no-new
        new URL(url);
        return true;
    } catch  {
        return false;
    }
}

//# sourceMappingURL=metroErrorInterface.js.map