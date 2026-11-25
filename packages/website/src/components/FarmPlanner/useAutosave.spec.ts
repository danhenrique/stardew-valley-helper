import { act, renderHook } from '@testing-library/react';
import type { PlacedObject } from '../../lib/farmPlanner/types';
import { AUTOSAVE_DELAY_MS, useAutosave } from './useAutosave';

type SaveInput = {
  planId: string;
  name: string;
  objects: PlacedObject[];
  version: number;
};

const A: PlacedObject[] = [{ t: 'scarecrow', x: 1, y: 1 }];
const B: PlacedObject[] = [{ t: 'scarecrow', x: 2, y: 2 }];
const C: PlacedObject[] = [{ t: 'scarecrow', x: 3, y: 3 }];
const SERVER: PlacedObject[] = [{ t: 'barn', x: 4, y: 4 }];

const conflict = { status: 409, error: { detail: 'Plan changed elsewhere' } };
const serverError = { status: 500, error: { detail: 'boom' } };

/** A promise the test resolves or rejects by hand. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const setup = () => {
  const save = vi.fn(async (input: SaveInput) => ({
    version: input.version + 1,
  }));
  const fetchPlan = vi.fn(async () => ({ version: 7, objects: SERVER }));
  const onReload = vi.fn();
  const hook = renderHook(() =>
    useAutosave({
      planId: 'plan-1',
      name: 'Ano 1',
      initialVersion: 1,
      save,
      fetchPlan,
      onReload,
    }),
  );
  return { save, fetchPlan, onReload, hook };
};

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const beforeUnloadPrevented = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosave', () => {
  it('should save once, 1.5 s after the last of two changes 1 s apart', async () => {
    const { save, hook } = setup();
    expect(AUTOSAVE_DELAY_MS).toBe(1500);
    act(() => hook.result.current.schedule(A));
    await advance(1000);
    act(() => hook.result.current.schedule(B));
    await advance(1499);
    expect(save).not.toHaveBeenCalled();
    await advance(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      planId: 'plan-1',
      name: 'Ano 1',
      objects: B,
      version: 1,
    });
    expect(hook.result.current.status).toBe('saved');
  });

  it('should send a change made during a save after it resolves, with the version it returned', async () => {
    const { save, hook } = setup();
    const first = deferred<{ version: number }>();
    save.mockImplementationOnce(() => first.promise);
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    expect(hook.result.current.status).toBe('saving');

    act(() => hook.result.current.schedule(B));
    act(() => hook.result.current.schedule(C));
    await advance(5000);
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve({ version: 2 }));
    await advance(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ objects: C, version: 2 });
    expect(hook.result.current.status).toBe('saved');
  });

  it('should show an error and retry after 2, 4 and 8 s, capped at 30 s', async () => {
    const { save, hook } = setup();
    save.mockRejectedValue(serverError);
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(hook.result.current.status).toBe('error');

    for (const [delay, calls] of [
      [2000, 2],
      [4000, 3],
      [8000, 4],
      [16000, 5],
      [30000, 6],
      [30000, 7],
    ]) {
      await advance(delay - 1);
      expect(save).toHaveBeenCalledTimes(calls - 1);
      await advance(1);
      expect(save).toHaveBeenCalledTimes(calls);
    }
    expect(save.mock.calls.every(([input]) => input.objects === A)).toBe(true);

    save.mockResolvedValue({ version: 2 });
    await advance(30000);
    expect(hook.result.current.status).toBe('saved');
  });

  it('should not retry a 4xx other than 409 and show the server detail', async () => {
    const { save, hook } = setup();
    save.mockRejectedValueOnce({
      status: 400,
      error: { detail: 'Too many objects (max 8000)' },
    });
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    expect(hook.result.current.status).toBe('error');
    expect(hook.result.current.errorMessage).toEqual({
      key: 'errors.api.tooManyObjects',
    });
    await advance(60000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(hook.result.current.unsaved).toBe(true);

    // The next edit may fix the plan: it is saved on the normal debounce.
    act(() => hook.result.current.schedule(B));
    await advance(1500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(hook.result.current.status).toBe('saved');
    expect(hook.result.current.errorMessage).toBeUndefined();
    expect(hook.result.current.unsaved).toBe(false);
  });

  it('should keep retrying network errors without a server detail', async () => {
    const { save, hook } = setup();
    save.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    expect(hook.result.current.status).toBe('error');
    expect(hook.result.current.errorMessage).toBeUndefined();
    await advance(2000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(hook.result.current.status).toBe('saved');
  });

  it('should save a new change on the normal debounce while in the error state', async () => {
    const { save, hook } = setup();
    save.mockRejectedValueOnce(serverError);
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    expect(hook.result.current.status).toBe('error');
    await advance(1000);
    act(() => hook.result.current.schedule(B));
    await advance(1500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ objects: B, version: 1 });
    expect(hook.result.current.status).toBe('saved');
  });

  it('should stop on a 409, then overwrite with the server version and the local objects', async () => {
    const { save, fetchPlan, onReload, hook } = setup();
    save.mockRejectedValueOnce(conflict);
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    expect(hook.result.current.status).toBe('conflict');
    await advance(60000);
    expect(save).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.schedule(B));
    await advance(1500);
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => hook.result.current.overwrite());
    await advance(0);
    expect(fetchPlan).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ objects: B, version: 7 });
    expect(onReload).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe('saved');
  });

  it('should reload the server objects and version on a 409 without saving', async () => {
    const { save, fetchPlan, onReload, hook } = setup();
    save.mockRejectedValueOnce(conflict);
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    await act(async () => hook.result.current.reload());
    await advance(5000);
    expect(fetchPlan).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledWith(SERVER);
    expect(save).toHaveBeenCalledTimes(1);
    expect(hook.result.current.status).toBe('saved');

    act(() => hook.result.current.schedule(B));
    await advance(1500);
    expect(save.mock.calls[1][0]).toMatchObject({ objects: B, version: 7 });
  });

  it('should keep the conflict when the server plan cannot be fetched', async () => {
    const { save, fetchPlan, hook } = setup();
    save.mockRejectedValueOnce(conflict);
    fetchPlan.mockRejectedValueOnce(serverError);
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    await act(async () => hook.result.current.overwrite());
    await advance(0);
    expect(hook.result.current.status).toBe('conflict');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('should ask before leaving only while changes are unsaved or a save is in flight', async () => {
    const { save, hook } = setup();
    const first = deferred<{ version: number }>();
    save.mockImplementationOnce(() => first.promise);
    expect(beforeUnloadPrevented()).toBe(false);
    act(() => hook.result.current.schedule(A));
    expect(beforeUnloadPrevented()).toBe(true);
    await advance(1500);
    expect(hook.result.current.status).toBe('saving');
    expect(beforeUnloadPrevented()).toBe(true);
    await act(async () => first.resolve({ version: 2 }));
    expect(hook.result.current.status).toBe('saved');
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it('should send pending changes when the editor unmounts', async () => {
    const { save, hook } = setup();
    act(() => hook.result.current.schedule(A));
    hook.unmount();
    await advance(0);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({ objects: A, version: 1 });
  });

  it('should try the final save once after unmount and never retry it', async () => {
    const { save, hook } = setup();
    save.mockRejectedValue(serverError);
    act(() => hook.result.current.schedule(A));
    hook.unmount();
    await advance(60000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('should finish the in-flight save and its follow-up after unmount, then stop', async () => {
    const { save, hook } = setup();
    const first = deferred<{ version: number }>();
    save.mockImplementationOnce(() => first.promise);
    act(() => hook.result.current.schedule(A));
    await advance(1500);
    act(() => hook.result.current.schedule(B));
    hook.unmount();
    await act(async () => first.resolve({ version: 2 }));
    await advance(60000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({ objects: B, version: 2 });
  });
});
