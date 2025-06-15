"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
const path_1 = __importDefault(require("path"));
exports.default = (0, config_1.defineConfig)({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'tests/',
                '**/pkg/**',
                '**/target/**'
            ]
        }
    },
    resolve: {
        alias: {
            '@': path_1.default.resolve(__dirname, './'),
            '@bridge': path_1.default.resolve(__dirname, './bridge'),
            '@core': path_1.default.resolve(__dirname, './core')
        }
    }
});
