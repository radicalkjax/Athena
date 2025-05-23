const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Add a rule for font files
  config.module.rules.push({
    test: /\.(woff|woff2|eot|ttf|otf)$/,
    loader: 'file-loader',
    options: {
      name: '[name].[ext]',
      outputPath: 'fonts/',
    },
  });
  
  // Add resolve alias for fonts
  config.resolve.alias = {
    ...config.resolve.alias,
    '@fonts': path.resolve(process.cwd(), 'Athena/assets/fonts'),
  };
  
  // Ensure fallback is initialized
  if (!config.resolve.fallback) {
    config.resolve.fallback = {};
  }
  
  // Add Node.js polyfills for browser compatibility
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "buffer": require.resolve("buffer"),
    "process": require.resolve("process/browser"),
    "util": require.resolve("util/"),
    "stream": require.resolve("stream-browserify"),
    "crypto": require.resolve("crypto-browserify"),
    "fs": false,
    "path": require.resolve("path-browserify"),
    "os": require.resolve("os-browserify/browser"),
  };
  
  // Ensure plugins array exists
  if (!config.plugins) {
    config.plugins = [];
  }
  
  // Add plugins for polyfills - place at the beginning to ensure they take precedence
  config.plugins.unshift(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    new webpack.DefinePlugin({
      'global': 'globalThis',
    })
  );
  
  return config;
};
