/**
 * Tauri compatibility layer for web deployment
 * Provides fallbacks for Tauri APIs when running as a web app
 */

// Check if running in Tauri context
export const isTauri = () => {
  try {
    return window.__TAURI__ !== undefined;
  } catch {
    return false;
  }
};

// Wrapper for invoke command
export const invokeCommand = async (command: string, args?: any): Promise<any> => {
  if (isTauri()) {
    // Tauri 2.0 uses @tauri-apps/api/core
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke(command, args);
  }
  
  // Web fallbacks for common commands
  switch (command) {
    case 'calculate_sha256':
      // Use Web Crypto API for SHA-256
      if (args?.bytes) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(args.bytes));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
      return '';
      
    case 'get_system_status':
      throw new Error('System monitoring is not available in web mode. Please use the desktop application.');

    case 'analyze_file':
      throw new Error('File analysis requires the desktop application. Web mode does not support this feature.');
      
    default:
      throw new Error(`Command "${command}" is not available in web mode. Please use the desktop application.`);
  }
};

// File dialog wrapper
export const openFileDialog = async (): Promise<string | string[] | null> => {
  if (isTauri()) {
    try {
      // Tauri 2.0 uses plugin-dialog
      // Omit filters to allow ALL file types
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: false,
        title: 'Select Malware Sample'
      });
      return result;
    } catch (err) {
      console.error('Failed to open file dialog:', err);
      throw new Error(`File dialog failed: ${err}`);
    }
  }

  // Web fallback - use HTML file input
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      resolve(file ? file.name : null);
    };
    input.click();
  });
};

// Platform detection
export const getPlatform = async (): Promise<string> => {
  if (isTauri()) {
    // @ts-ignore - Tauri API
    const { platform } = window.__TAURI__.os;
    return platform();
  }
  
  // Detect platform from user agent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('linux')) return 'linux';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  return 'web';
};

// Window controls wrapper
export const appWindow = {
  minimize: async () => {
    if (isTauri()) {
      // @ts-ignore - Tauri API
      const { appWindow } = window.__TAURI__.window;
      return appWindow.minimize();
    }
    // No-op for web
  },
  
  maximize: async () => {
    if (isTauri()) {
      // @ts-ignore - Tauri API
      const { appWindow } = window.__TAURI__.window;
      return appWindow.maximize();
    }
    // Try fullscreen API for web
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  },
  
  close: async () => {
    if (isTauri()) {
      // @ts-ignore - Tauri API
      const { appWindow } = window.__TAURI__.window;
      return appWindow.close();
    }
    // For web, just close the tab
    window.close();
  }
};

// Export type for TypeScript
declare global {
  interface Window {
    __TAURI__?: any;
  }
}