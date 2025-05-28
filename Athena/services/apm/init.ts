/**
 * APM initialization
 */

import { apmManager } from './manager';
import { env } from '@/shared/config/environment';
import { logger } from '@/shared/logging/logger';

let initialized = false;

export async function initializeAPM(): Promise<void> {
  if (initialized) {
    return;
  }

  try {
    const apmConfig = env.apm;
    
    if (!apmConfig.enabled) {
      logger.info('APM is disabled');
      return;
    }

    await apmManager.initialize({
      serviceName: 'athena',
      environment: env.environment,
      version: env.appVersion,
      sampleRate: apmConfig.sampleRate,
      enabled: apmConfig.enabled,
      endpoint: apmConfig.endpoint,
      apiKey: apmConfig.apiKey,
    });

    initialized = true;
    logger.info(`APM initialized with ${apmConfig.provider} provider`);

    // Register shutdown handler
    if (typeof process !== 'undefined') {
      process.on('SIGINT', async () => {
        await shutdownAPM();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await shutdownAPM();
        process.exit(0);
      });
    }
  } catch (error) {
    logger.error('Failed to initialize APM:', error);
  }
}

export async function shutdownAPM(): Promise<void> {
  if (!initialized) {
    return;
  }

  try {
    await apmManager.shutdown();
    initialized = false;
    logger.info('APM shutdown complete');
  } catch (error) {
    logger.error('Failed to shutdown APM:', error);
  }
}