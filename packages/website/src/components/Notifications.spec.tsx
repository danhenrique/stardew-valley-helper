import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  apiErrorMessage,
  NotificationsProvider,
  UNDO_TIMEOUT_MS,
  useNotifications,
} from './Notifications';

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
    render(
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
    render(
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
    render(
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
    const { container } = render(
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
    render(
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
    render(
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
      apiErrorMessage({
        status: 404,
        error: { detail: 'Planting not found' },
      }),
    ).toBe('Plantio não encontrado.');
  });

  it('should use a generic message when error is unknown', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe(
      'Não foi possível salvar. Tente novamente.',
    );
  });
});
