// Export types first (only once)
export * from './types';

// Export all mocked WASM bridge modules (excluding types to avoid conflicts)
export {
  analysisEngine,
  AnalysisEngineBridge,
  initializeAnalysisEngine,
  createAnalysisEngine
} from './analysis-engine-bridge-enhanced';

export { cryptoBridge, CryptoBridge } from './crypto-bridge';
export { deobfuscatorBridge, DeobfuscatorBridge } from './deobfuscator-bridge';
export { createFileProcessor, IFileProcessor, getFileProcessor } from './file-processor-bridge';
export { networkBridge, NetworkBridge } from './network-bridge';
export { patternMatcherBridge, PatternMatcherBridge } from './pattern-matcher-bridge';
export { sandboxBridge, SandboxBridge } from './sandbox-bridge';
export * from './type-marshaling';

// Export React Native bridge
export {
  ReactNativeBridge,
  reactNativeBridge,
  initializeReactNativeBridge,
  createReactNativeBridge
} from './react-native-bridge';

// Import networkBridge for the getter function
import { networkBridge } from './network-bridge';

// Export getNetworkBridge function
export function getNetworkBridge() {
  return networkBridge;
}