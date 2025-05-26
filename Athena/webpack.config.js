const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');
const webpack = require('webpack');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Import proxy configuration
  const { getWebpackProxyConfig } = require('./config/proxy');
  
  // Add proxy configuration for development
  if (config.devServer) {
    config.devServer.proxy = getWebpackProxyConfig();
  }
  
  // Add a rule for font files with better error handling
  config.module.rules.push({
    test: /\.(woff|woff2|eot|ttf|otf)$/,
    use: {
      loader: 'file-loader',
      options: {
        name: '[name].[hash:8].[ext]',
        outputPath: 'fonts/',
        publicPath: '/fonts/',
        esModule: false,
      },
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
