// Mock for expo-secure-store
const SecureStore = {
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
  isAvailableAsync: async () => true,
};

module.exports = SecureStore;
module.exports.default = SecureStore;