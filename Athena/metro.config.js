const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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
