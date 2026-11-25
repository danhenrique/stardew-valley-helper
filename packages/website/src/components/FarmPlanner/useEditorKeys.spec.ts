import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type EditorKeyHandlers, useEditorKeys } from './useEditorKeys';

const handlers = (): EditorKeyHandlers => ({
  hasSelection: true,
  setTool: vi.fn(),
  deleteSelection: vi.fn(),
  moveSelection: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  clearSelection: vi.fn(),
});

describe('useEditorKeys', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should run the shortcuts while no dialog is open', async () => {
    const h = handlers();
    renderHook(() => useEditorKeys(h));
    await userEvent.keyboard('e{Delete}{ArrowLeft}{Control>}z{/Control}');
    expect(h.setTool).toHaveBeenCalledWith('delete');
    expect(h.deleteSelection).toHaveBeenCalledTimes(1);
    expect(h.moveSelection).toHaveBeenCalledWith(-1, 0);
    expect(h.undo).toHaveBeenCalledTimes(1);
  });

  it('should ignore every shortcut while a dialog is open', async () => {
    const h = handlers();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    const { result } = renderHook(() => useEditorKeys(h));
    await userEvent.keyboard(
      'e{Delete}{ArrowLeft}{Escape}{Control>}z{/Control}{ }',
    );
    expect(h.setTool).not.toHaveBeenCalled();
    expect(h.deleteSelection).not.toHaveBeenCalled();
    expect(h.moveSelection).not.toHaveBeenCalled();
    expect(h.clearSelection).not.toHaveBeenCalled();
    expect(h.undo).not.toHaveBeenCalled();
    expect(result.current.spaceHeld).toBe(false);
  });
});
