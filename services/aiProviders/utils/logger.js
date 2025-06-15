"use strict";
/**
 * Simple logger utility
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.level = LogLevel.INFO;
    }
    setLevel(level) {
        this.level = level;
    }
    error(message, meta) {
        if (this.level >= LogLevel.ERROR) {
            console.error(`[ERROR] ${message}`, meta || '');
        }
    }
    warn(message, meta) {
        if (this.level >= LogLevel.WARN) {
            console.warn(`[WARN] ${message}`, meta || '');
        }
    }
    info(message, meta) {
        if (this.level >= LogLevel.INFO) {
            console.info(`[INFO] ${message}`, meta || '');
        }
    }
    debug(message, meta) {
        if (this.level >= LogLevel.DEBUG) {
            console.debug(`[DEBUG] ${message}`, meta || '');
        }
    }
}
exports.Logger = Logger;
exports.logger = new Logger();
