// Type declarations for Tauri API when available
declare global {
  interface Window {
    __TAURI__?: {
      tauri: {
        invoke: (cmd: string, args?: any) => Promise<any>;
      };
      dialog: {
        open: (options?: any) => Promise<string | string[] | null>;
      };
      os: {
        platform: () => Promise<string>;
      };
      window: {
        appWindow: {
          minimize: () => Promise<void>;
          maximize: () => Promise<void>;
          close: () => Promise<void>;
        };
      };
      event: {
        listen: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;
      };
    };
  }
}

export {};