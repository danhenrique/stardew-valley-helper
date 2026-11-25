import { screen } from '@testing-library/react';
import { renderWithIntl } from '../renderWithIntl';
import { ConflictDialog } from './ConflictDialog';
import { LeaveDialog } from './LeaveDialog';

describe('ConflictDialog', () => {
  it('should show the conflict in Portuguese', () => {
    renderWithIntl(
      <ConflictDialog open onReload={vi.fn()} onOverwrite={vi.fn()} />,
    );
    expect(screen.getByText('Plano alterado em outro lugar')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sobrescrever' })).toBeVisible();
  });

  it('should show the conflict in English', () => {
    renderWithIntl(
      <ConflictDialog open onReload={vi.fn()} onOverwrite={vi.fn()} />,
      { locale: 'en' },
    );
    expect(screen.getByText('Plan changed elsewhere')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Overwrite' })).toBeVisible();
  });
});

describe('LeaveDialog', () => {
  it('should ask in Portuguese', () => {
    renderWithIntl(<LeaveDialog open onLeave={vi.fn()} onStay={vi.fn()} />);
    expect(screen.getByText('Sair sem salvar?')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Continuar editando' }),
    ).toBeVisible();
  });

  it('should ask in English', () => {
    renderWithIntl(<LeaveDialog open onLeave={vi.fn()} onStay={vi.fn()} />, {
      locale: 'en',
    });
    expect(screen.getByText('Leave without saving?')).toBeVisible();
    expect(screen.getByText('You have unsaved changes.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeVisible();
  });
});
