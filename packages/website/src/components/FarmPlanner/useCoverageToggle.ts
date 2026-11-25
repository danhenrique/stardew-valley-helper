import { useCallback, useState } from 'react';

const KEY = 'farmPlanner.coverage';

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** [on, toggle, turnOn] for the coverage layer; remembered per browser, off by default. */
export const useCoverageToggle = (): [boolean, () => void, () => void] => {
  const [on, setOn] = useState(read);
  const set = useCallback((next: (current: boolean) => boolean) => {
    setOn((current) => {
      const value = next(current);
      try {
        localStorage.setItem(KEY, value ? '1' : '0');
      } catch {
        // Storage blocked (private window): the choice lasts for this page only.
      }
      return value;
    });
  }, []);
  const toggle = useCallback(() => set((current) => !current), [set]);
  const turnOn = useCallback(() => set(() => true), [set]);
  return [on, toggle, turnOn];
};
