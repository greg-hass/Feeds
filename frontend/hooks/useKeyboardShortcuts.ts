import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Keyboard shortcuts for web platform
 * Provides power user navigation and actions
 */

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          metaMatch &&
          shiftMatch
        ) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Common shortcuts
export const SHORTCUTS = {
  REFRESH: { key: 'r', description: 'Refresh feed' },
  SEARCH: { key: '/', description: 'Focus search' },
  BOOKMARK: { key: 'b', description: 'Bookmark article' },
  MARK_READ: { key: 'm', description: 'Mark as read' },
  NEXT: { key: 'j', description: 'Next article' },
  PREV: { key: 'k', description: 'Previous article' },
  OPEN: { key: 'o', description: 'Open article' },
  HELP: { key: '?', shift: true, description: 'Show shortcuts' },
};
