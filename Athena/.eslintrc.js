// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', 'react-native-dist/*', 'node_modules/*'],
  env: {
    jest: true,
    browser: true,
    node: true,
    es2021: true,
  },
  globals: {
    __dirname: 'readonly',
    __filename: 'readonly',
    Buffer: 'readonly',
    process: 'readonly',
    global: 'readonly',
    setTimeout: 'readonly',
    setInterval: 'readonly',
    clearTimeout: 'readonly',
    clearInterval: 'readonly',
    setImmediate: 'readonly',
    clearImmediate: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    AbortController: 'readonly',
    AbortSignal: 'readonly',
    EventSource: 'readonly',
    WebSocket: 'readonly',
    FileReader: 'readonly',
    File: 'readonly',
    Blob: 'readonly',
    FormData: 'readonly',
    Headers: 'readonly',
    Request: 'readonly',
    Response: 'readonly',
    fetch: 'readonly',
    performance: 'readonly',
    atob: 'readonly',
    btoa: 'readonly',
    localStorage: 'readonly',
    sessionStorage: 'readonly',
    indexedDB: 'readonly',
    document: 'readonly',
    window: 'readonly',
    navigator: 'readonly',
    location: 'readonly',
    history: 'readonly',
    HTMLElement: 'readonly',
    Element: 'readonly',
    Node: 'readonly',
    NodeList: 'readonly',
    Event: 'readonly',
    EventTarget: 'readonly',
    XMLHttpRequest: 'readonly',
    // K6 specific globals for load testing
    __ENV: 'readonly',
    __VU: 'readonly',
    __ITER: 'readonly',
  },
  overrides: [
    {
      files: ['__tests__/**/*', '__mocks__/**/*', '*.test.*', '*.spec.*'],
      env: {
        jest: true,
      },
    },
    {
      files: ['tests/load/**/*.js'],
      // K6 load test files have their own environment
      globals: {
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
      },
    },
  ],
  rules: {
    // Disable dynamic environment variable check since we've refactored to avoid it
    'expo/no-dynamic-env-var': 'off',
    // Ignore k6 imports for load testing files
    'import/no-unresolved': ['error', {
      ignore: ['k6', 'k6/.*']
    }],
  },
};