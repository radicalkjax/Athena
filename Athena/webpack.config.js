const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

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
    '@fonts': path.resolve(__dirname, 'assets/fonts'),
  };
  
  return config;
};
