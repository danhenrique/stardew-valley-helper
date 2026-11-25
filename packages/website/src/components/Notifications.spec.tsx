import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { textOf } from '../lib/messageText.spec-helpers';
import {
  apiErrorMessage,
  NotificationsProvider,
  UNDO_TIMEOUT_MS,
  useNotifications,
} from './Notifications';
import { renderWithIntl } from './renderWithIntl';

const Trigger = ({ message }: { message: string }) => {
  const { notifyError } = useNotifications();
  return (
    <button type="button" onClick={() => notifyError(message)}>
      disparar
    </button>
  );
};

describe('Notifications', () => {
  it('should show the error and close it when the close button is clicked', async () => {
    renderWithIntl(
      <NotificationsProvider>
        <Trigger message="Falhou" />
      </NotificationsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'disparar' }));
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Fechar' });
    expect(close).toHaveAttribute('title', 'Fechar');
    await act(() => userEvent.click(close));
    await waitFor(() =>
      expect(screen.queryByText('Falhou')).not.toBeInTheDocument(),
    );
  });
});

describe('undo notifications', () => {
  const UndoTrigger = ({
    messages,
    onUndo,
  }: {
    messages: string[];
    onUndo: () => void;
  }) => {
    const { notifyUndo } = useNotifications();
    return (
      <button
        type="button"
        onClick={() => messages.forEach((m) => notifyUndo(m, onUndo))}
      >
        remover
      </button>
    );
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call onUndo when Desfazer is clicked', async () => {
    const onUndo = vi.fn();
    renderWithIntl(
      <NotificationsProvider>
        <UndoTrigger messages={['Plantio removido']} onUndo={onUndo} />
      </NotificationsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'remover' }));
    expect(screen.getByText('Plantio removido')).toBeInTheDocument();
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Desfazer' })),
    );
    expect(onUndo).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByText('Plantio removido')).not.toBeInTheDocument(),
    );
  });

  it('should call onUndo once when Desfazer is double-clicked', async () => {
    const onUndo = vi.fn();
    renderWithIntl(
      <NotificationsProvider>
        <UndoTrigger messages={['Plantio removido']} onUndo={onUndo} />
      </NotificationsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'remover' }));
    await act(() =>
      userEvent.dblClick(screen.getByRole('button', { name: 'Desfazer' })),
    );
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('should not render the error variant while an undo notification leaves', async () => {
    const { container } = renderWithIntl(
      <NotificationsProvider>
        <UndoTrigger messages={['Plantio removido']} onUndo={vi.fn()} />
      </NotificationsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'remover' }));
    const seen: boolean[] = [];
    const observer = new MutationObserver(() =>
      seen.push(
        container.ownerDocument.querySelector('svg.text-red-400') !== null,
      ),
    );
    observer.observe(container.ownerDocument.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Desfazer' })),
    );
    observer.disconnect();
    expect(seen).not.toContain(true);
  });

  it('should hide the undo notification after 5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onUndo = vi.fn();
    renderWithIntl(
      <NotificationsProvider>
        <UndoTrigger messages={['Plantio removido']} onUndo={onUndo} />
      </NotificationsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'remover' }));
    expect(screen.getByText('Plantio removido')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(UNDO_TIMEOUT_MS));
    await waitFor(() =>
      expect(screen.queryByText('Plantio removido')).not.toBeInTheDocument(),
    );
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('should replace the previous undo notification', async () => {
    renderWithIntl(
      <NotificationsProvider>
        <UndoTrigger messages={['Primeiro', 'Segundo']} onUndo={vi.fn()} />
      </NotificationsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'remover' }));
    expect(screen.queryByText('Primeiro')).not.toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });
});

describe('apiErrorMessage', () => {
  it('should use the API detail when a 404 carries a string detail', () => {
    expect(
      textOf(
        apiErrorMessage({
          status: 404,
          error: { detail: 'Planting not found' },
        }),
      ),
    ).toBe('Plantio não encontrado.');
  });

  it('should translate the farm plan save errors, keeping their object details', () => {
    const detail = (d: string) =>
      apiErrorMessage({ status: 400, error: { detail: d } });
    expect(textOf(detail('Too many objects (max 8000)'))).toBe(
      'Limite de 8.000 objetos atingido.',
    );
    expect(textOf(detail('Unknown object: foo'))).toBe(
      'Objeto desconhecido: foo',
    );
    expect(textOf(detail('Object outside the farm: barn at (90, 3)'))).toBe(
      'Objeto fora da fazenda: barn at (90, 3)',
    );
    expect(textOf(detail('Missing fixed object: farmhouse'))).toBe(
      'Objeto fixo ausente: farmhouse',
    );
  });

  it('should use a generic message when error is unknown', () => {
    expect(textOf(apiErrorMessage(new Error('boom')))).toBe(
      'Não foi possível salvar. Tente novamente.',
    );
  });
});

describe('Notifications in English', () => {
  it('should name the close button and the undo action in English', async () => {
    const Both = () => {
      const { notifyUndo } = useNotifications();
      return (
        <button type="button" onClick={() => notifyUndo('Removed', vi.fn())}>
          go
        </button>
      );
    };
    renderWithIntl(
      <NotificationsProvider>
        <Both />
      </NotificationsProvider>,
      { locale: 'en' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute(
      'title',
      'Close',
    );
  });

  it('should translate a 404 and the generic fallback under en', () => {
    expect(
      textOf(
        apiErrorMessage({
          status: 404,
          error: { detail: 'Planting not found' },
        }),
        'en',
      ),
    ).toBe('Planting not found.');
    expect(textOf(apiErrorMessage(new Error('boom')), 'en')).toBe(
      'Could not save. Try again.',
    );
  });
});
