import { onMount, onCleanup } from 'solid-js';

export interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: () => void;
  description: string;
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, ShortcutHandler> = new Map();
  private enabled = true;

  constructor() {
    this.initializeDefaultShortcuts();
  }

  private initializeDefaultShortcuts() {
    // File operations
    this.register({
      key: 'o',
      ctrl: true,
      handler: () => this.triggerFileOpen(),
      description: 'Open file'
    });

    this.register({
      key: 's',
      ctrl: true,
      handler: () => this.triggerSave(),
      description: 'Save current analysis'
    });

    this.register({
      key: 'e',
      ctrl: true,
      shift: true,
      handler: () => this.triggerExport(),
      description: 'Export analysis'
    });

    // Navigation
    this.register({
      key: '1',
      alt: true,
      handler: () => this.navigateToTab('static'),
      description: 'Go to Static Analysis'
    });

    this.register({
      key: '2',
      alt: true,
      handler: () => this.navigateToTab('dynamic'),
      description: 'Go to Dynamic Analysis'
    });

    this.register({
      key: '3',
      alt: true,
      handler: () => this.navigateToTab('network'),
      description: 'Go to Network Analysis'
    });

    this.register({
      key: '4',
      alt: true,
      handler: () => this.navigateToTab('ai'),
      description: 'Go to AI Analysis'
    });

    // Analysis operations
    this.register({
      key: 'r',
      ctrl: true,
      handler: () => this.refreshAnalysis(),
      description: 'Refresh analysis'
    });

    this.register({
      key: 'Escape',
      handler: () => this.closeModals(),
      description: 'Close modal/dialog'
    });

    // Search
    this.register({
      key: 'f',
      ctrl: true,
      handler: () => this.focusSearch(),
      description: 'Focus search'
    });

    // Help
    this.register({
      key: '?',
      shift: true,
      handler: () => this.showShortcutHelp(),
      description: 'Show keyboard shortcuts'
    });
  }

  private generateKey(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    if (e.metaKey) parts.push('meta');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  register(shortcut: ShortcutHandler) {
    const key = this.generateKeyFromShortcut(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  unregister(shortcut: ShortcutHandler) {
    const key = this.generateKeyFromShortcut(shortcut);
    this.shortcuts.delete(key);
  }

  private generateKeyFromShortcut(shortcut: ShortcutHandler): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.meta) parts.push('meta');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  handleKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable) {
      return;
    }

    const key = this.generateKey(e);
    const shortcut = this.shortcuts.get(key);

    if (shortcut) {
      e.preventDefault();
      e.stopPropagation();
      shortcut.handler();
    }
  };

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  // Action implementations
  private triggerFileOpen() {
    const fileInput = document.querySelector('#file-upload-input') as HTMLInputElement;
    fileInput?.click();
  }

  private triggerSave() {
    window.dispatchEvent(new CustomEvent('save-analysis'));
  }

  private triggerExport() {
    window.dispatchEvent(new CustomEvent('export-analysis'));
  }

  private navigateToTab(tab: string) {
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab } }));
  }

  private refreshAnalysis() {
    window.dispatchEvent(new CustomEvent('refresh-analysis'));
  }

  private closeModals() {
    window.dispatchEvent(new CustomEvent('close-modals'));
  }

  private focusSearch() {
    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
    searchInput?.focus();
  }

  private showShortcutHelp() {
    window.dispatchEvent(new CustomEvent('show-shortcut-help'));
  }

  getShortcuts(): ShortcutHandler[] {
    return Array.from(this.shortcuts.values());
  }
}

// Singleton instance
export const shortcutManager = new KeyboardShortcutManager();

// Hook for SolidJS components
export function useKeyboardShortcuts() {
  onMount(() => {
    window.addEventListener('keydown', shortcutManager.handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', shortcutManager.handleKeyDown);
  });

  return shortcutManager;
}

// Helper to get formatted shortcut display
export function getShortcutDisplay(shortcut: ShortcutHandler): string {
  const keys: string[] = [];
  if (shortcut.ctrl) keys.push('Ctrl');
  if (shortcut.shift) keys.push('Shift');
  if (shortcut.alt) keys.push('Alt');
  if (shortcut.meta) keys.push('Cmd');
  keys.push(shortcut.key);
  return keys.join('+');
}