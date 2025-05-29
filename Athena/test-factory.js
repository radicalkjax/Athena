const tsNode = require('ts-node');
tsNode.register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    paths: {
      '@/*': ['./']
    }
  }
});

try {
  const { circuitBreakerFactory } = require('./services/ai/circuitBreakerFactory');
  console.log('Type:', typeof circuitBreakerFactory.getAllStats);
  console.log('Has getAllStats:', 'getAllStats' in circuitBreakerFactory);
  console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(circuitBreakerFactory)));
} catch (e) {
  console.error('Error:', e.message);
}
