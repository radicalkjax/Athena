// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*'],
  env: {
    jest: true,
  },
  overrides: [
    {
      files: ['__tests__/**/*', '__mocks__/**/*', '*.test.*', '*.spec.*'],
      env: {
        jest: true,
      },
    },
  ],
};
