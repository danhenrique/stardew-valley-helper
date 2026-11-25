import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCoverageToggle } from './useCoverageToggle';

const KEY = 'farmPlanner.coverage';

describe('useCoverageToggle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('should start off when nothing is stored', () => {
    const { result } = renderHook(() => useCoverageToggle());
    expect(result.current[0]).toBe(false);
  });

  it('should store the choice when it is toggled', () => {
    const { result } = renderHook(() => useCoverageToggle());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('should read the stored choice when it mounts again', () => {
    localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useCoverageToggle());
    expect(result.current[0]).toBe(true);
  });

  it('should still toggle when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useCoverageToggle());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });
});
