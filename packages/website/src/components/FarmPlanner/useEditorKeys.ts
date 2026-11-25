import { useEffect, useRef, useState } from 'react';

export type Tool = 'place' | 'select' | 'delete';

export type EditorKeyHandlers = {
  hasSelection: boolean;
  setTool: (tool: Tool) => void;
  deleteSelection: () => void;
  moveSelection: (dx: number, dy: number) => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
};

const TOOL_KEYS: Record<string, Tool> = {
  b: 'place',
  v: 'select',
  e: 'delete',
};
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** A modal (conflict dialog, mobile drawer) owns the keyboard while it is open. */
const dialogOpen = () => document.querySelector('[role="dialog"]') !== null;

/** Editor shortcuts on window: B/V/E, Delete/Backspace, arrows, Ctrl+Z / Ctrl+Shift+Z, Space (pan). */
export const useEditorKeys = (handlers: EditorKeyHandlers) => {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || dialogOpen()) return;
      const h = ref.current;
      const key = event.key;
      const lower = key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (lower === 'z') {
          event.preventDefault();
          if (event.shiftKey) h.redo();
          else h.undo();
        } else if (lower === 'y') {
          event.preventDefault();
          h.redo();
        }
        return;
      }
      if (event.altKey) return;
      if (key === ' ') {
        // A focused button keeps Space for its own activation.
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        setSpaceHeld(true);
      } else if (TOOL_KEYS[lower]) {
        h.setTool(TOOL_KEYS[lower]);
      } else if (!h.hasSelection) {
        if (key === 'Escape') h.clearSelection();
      } else if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault();
        h.deleteSelection();
      } else if (ARROWS[key]) {
        event.preventDefault();
        h.moveSelection(...ARROWS[key]);
      } else if (key === 'Escape') {
        h.clearSelection();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return { spaceHeld };
};
