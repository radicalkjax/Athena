const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  // Get the default Expo webpack config
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Override for debugging production builds
  if (argv.mode === 'production') {
    // Enable source maps for debugging
    config.devtool = 'source-map';
    
    // Disable minification for easier debugging
    config.optimization = {
      ...config.optimization,
      minimize: false,
      // Disable tree shaking to see if it's causing issues
      usedExports: false,
      sideEffects: false,
    };
    
    // Add webpack bundle analyzer
    const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
    config.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: 'bundle-report.html',
        openAnalyzer: false,
      })
    );
    
    // Log which components are being processed
    config.module.rules.forEach(rule => {
      if (rule.use && rule.use.loader && rule.use.loader.includes('babel-loader')) {
        rule.use.options = {
          ...rule.use.options,
          plugins: [
            ...(rule.use.options.plugins || []),
            // Add plugin to log component names during build
            function() {
              return {
                visitor: {
                  Program(path, state) {
                    const filename = state.file.opts.filename;
                    if (filename && filename.includes('components')) {
                      console.log('Processing component:', filename);
                    }
                  }
                }
              };
            }
          ]
        };
      }
    });
  }
  
  return config;
};