import { logger } from './loggingService';
import { performanceConfig } from '../config/performance';

class PreloadService {
  private preloadQueue = new Set<string>();
  private preloadTimers = new Map<string, number>();
  private loadedModules = new Map<string, any>();

  // Component loaders map
  private componentLoaders: Record<string, () => Promise<any>> = {
    'static': () => import('../components/solid/analysis/StaticAnalysis'),
    'dynamic': () => import('../components/solid/analysis/DynamicAnalysis'),
    'ai-ensemble': () => import('../components/solid/analysis/AIEnsemble'),
    'network': () => import('../components/solid/analysis/NetworkAnalysis'),
    'hex': () => import('../components/solid/analysis/HexViewer'),
    'disassembly': () => import('../components/solid/analysis/Disassembly'),
    'reports': () => import('../components/solid/analysis/Reports'),
    'yara': () => import('../components/solid/analysis/YaraScanner'),
    'threat-intel': () => import('../components/solid/analysis/ThreatIntelligence'),
    'memory': () => import('../components/solid/analysis/MemoryAnalysis'),
    'workflows': () => import('../components/solid/analysis/CustomWorkflows'),
    'platform-config': () => import('../components/solid/PlatformConfig'),
  };

  /**
   * Preload a component after a delay
   */
  preloadComponent(componentName: string) {
    if (!performanceConfig.lazyLoading.preloadOnHover) return;
    if (this.loadedModules.has(componentName)) return;
    if (this.preloadQueue.has(componentName)) return;

    // Clear any existing timer
    const existingTimer = this.preloadTimers.get(componentName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.doPreload(componentName);
    }, performanceConfig.lazyLoading.preloadDelay);

    this.preloadTimers.set(componentName, timer);
  }

  /**
   * Cancel preloading of a component
   */
  cancelPreload(componentName: string) {
    const timer = this.preloadTimers.get(componentName);
    if (timer) {
      clearTimeout(timer);
      this.preloadTimers.delete(componentName);
    }
  }

  /**
   * Actually perform the preload
   */
  private async doPreload(componentName: string) {
    const loader = this.componentLoaders[componentName];
    if (!loader) return;

    this.preloadQueue.add(componentName);
    logger.debug(`Preloading component: ${componentName}`);

    try {
      const module = await loader();
      this.loadedModules.set(componentName, module);
      logger.debug(`Successfully preloaded: ${componentName}`);
    } catch (error) {
      logger.error(`Failed to preload component ${componentName}:`, error);
    } finally {
      this.preloadQueue.delete(componentName);
      this.preloadTimers.delete(componentName);
    }
  }

  /**
   * Check if a component is already loaded
   */
  isLoaded(componentName: string): boolean {
    return this.loadedModules.has(componentName);
  }

  /**
   * Get a preloaded module
   */
  getModule(componentName: string) {
    return this.loadedModules.get(componentName);
  }

  /**
   * Preload critical components on app start
   */
  async preloadCritical() {
    const criticalComponents = ['static', 'ai-ensemble', 'network'];
    
    logger.info('Preloading critical components...');
    
    const promises = criticalComponents.map(comp => this.doPreload(comp));
    await Promise.allSettled(promises);
    
    logger.info('Critical components preloaded');
  }

  /**
   * Clear preload cache to free memory
   */
  clearCache() {
    this.loadedModules.clear();
    this.preloadQueue.clear();
    this.preloadTimers.forEach(timer => clearTimeout(timer));
    this.preloadTimers.clear();
    logger.info('Preload cache cleared');
  }
}

export const preloadService = new PreloadService();