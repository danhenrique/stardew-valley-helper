import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlTestProvider } from '../components/renderWithIntl';
import { BERRY_PLANTING, machineBatch, SPRING_1 } from '../components/testData';
import type { Locale } from '../lib/locale';
import { useMachineActions } from './useMachineActions';
import { usePlantingActions } from './usePlantingActions';

const mocks = vi.hoisted(() => ({
  notifyUndo: vi.fn(),
  notifyError: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock('../components/Notifications', () => ({
  apiErrorMessage: vi.fn(),
  useNotifications: () => ({
    notifyUndo: mocks.notifyUndo,
    notifyError: mocks.notifyError,
  }),
}));

vi.mock('./useGameData', () => {
  const mutation = () => ({ mutateAsync: mocks.mutateAsync });
  return {
    useCreatePlanting: mutation,
    useDeletePlanting: mutation,
    useUpdatePlanting: mutation,
    useCreateMachineBatch: mutation,
    useDeleteMachineBatch: mutation,
    useUpdateMachineBatch: mutation,
  };
});

const wrapperFor =
  (locale: Locale) =>
  ({ children }: { children: ReactNode }) => (
    <IntlTestProvider locale={locale}>{children}</IntlTestProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutateAsync.mockResolvedValue(undefined);
});

describe('action notifications', () => {
  it.each([
    ['pt-BR', 'Plantio replantado', 'Plantio removido'],
    ['en', 'Planting replanted', 'Planting removed'],
  ] as const)(
    'should notify planting actions in %s',
    async (locale, replanted, removed) => {
      const { result } = renderHook(() => usePlantingActions(SPRING_1), {
        wrapper: wrapperFor(locale),
      });
      await act(async () => result.current.replant(BERRY_PLANTING));
      expect(mocks.notifyUndo).toHaveBeenLastCalledWith(
        replanted,
        expect.any(Function),
      );
      await act(async () => result.current.remove(BERRY_PLANTING));
      expect(mocks.notifyUndo).toHaveBeenLastCalledWith(
        removed,
        expect.any(Function),
      );
    },
  );

  it.each([
    ['pt-BR', 'Máquina recolocada', 'Máquina esvaziada'],
    ['en', 'Machine refilled', 'Machine emptied'],
  ] as const)(
    'should notify machine actions in %s',
    async (locale, recollected, emptied) => {
      const { result } = renderHook(() => useMachineActions(SPRING_1), {
        wrapper: wrapperFor(locale),
      });
      await act(async () => result.current.recollect(machineBatch()));
      expect(mocks.notifyUndo).toHaveBeenLastCalledWith(
        recollected,
        expect.any(Function),
      );
      await act(async () => result.current.remove(machineBatch()));
      expect(mocks.notifyUndo).toHaveBeenLastCalledWith(
        emptied,
        expect.any(Function),
      );
    },
  );
});
