module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          alias: {
            '@': './',
            '@components': './components',
            '@constants': './constants',
            '@hooks': './hooks',
            '@services': './services',
            '@store': './store',
            '@types': './types',
            '@utils': './utils',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      ],
    ],
  };
};
