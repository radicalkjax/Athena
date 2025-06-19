// Mock for expo-constants
const Constants = {
  manifest: {
    name: 'Athena',
    version: '1.0.0',
    extra: {},
  },
  expoVersion: '49.0.0',
  isDevice: true,
  platform: {
    ios: {
      systemVersion: '15.0',
    },
  },
  deviceName: 'Test Device',
  systemVersion: '15.0',
  executionEnvironment: 'standalone',
  statusBarHeight: 44,
  deviceYearClass: 2021,
  getWebViewUserAgentAsync: async () => 'MockUserAgent',
};

module.exports = Constants;
module.exports.default = Constants;