const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure expo-router is properly configured
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// Explicitly set the project root
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

// Ensure the app directory is included
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..')
];

// Add polyfills for Node.js modules
config.resolver.alias = {
  ...config.resolver.alias,
  'buffer': require.resolve('buffer'),
  'process': require.resolve('process/browser'),
  'util': require.resolve('util/'),
  'stream': require.resolve('stream-browserify'),
  'crypto': require.resolve('crypto-browserify'),
  'path': require.resolve('path-browserify'),
  'os': require.resolve('os-browserify/browser'),
};

// Add global polyfills
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
