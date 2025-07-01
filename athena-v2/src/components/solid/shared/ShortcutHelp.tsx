import { Component, For } from 'solid-js';
import { shortcutManager, getShortcutDisplay } from '../../../services/keyboardShortcuts';

export const ShortcutHelp: Component = () => {
  const shortcuts = shortcutManager.getShortcuts();

  return (
    <div class="shortcut-help">
      <h3>Keyboard Shortcuts</h3>
      <div class="shortcut-list">
        <For each={shortcuts}>
          {(shortcut) => (
            <div class="shortcut-item">
              <span class="shortcut-keys">
                <kbd>{getShortcutDisplay(shortcut)}</kbd>
              </span>
              <span class="shortcut-description">{shortcut.description}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};