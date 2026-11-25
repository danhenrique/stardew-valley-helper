import { screen } from '@testing-library/react';
import { message } from '../../lib/message';
import { renderWithIntl } from '../renderWithIntl';
import { SaveStatus } from './SaveStatus';

describe('SaveStatus', () => {
  it('should add the server detail to the error in Portuguese', () => {
    renderWithIntl(<SaveStatus status="error" message="Falhou" />);
    expect(
      screen.getByRole('status', { name: 'Salvamento' }),
    ).toHaveTextContent('Erro ao salvar: Falhou');
  });

  it('should add a translated server detail to the error in English', () => {
    renderWithIntl(
      <SaveStatus
        status="error"
        message={message('farmPlanner.issue.limit')}
      />,
      { locale: 'en' },
    );
    expect(
      screen.getByRole('status', { name: 'Save status' }),
    ).toHaveTextContent('Could not save: Limit of 8,000 objects reached');
  });

  it.each([
    ['saving', 'Saving…'],
    ['saved', 'Saved'],
    ['conflict', 'Save conflict'],
  ] as const)('should say %s in English', (status, text) => {
    renderWithIntl(<SaveStatus status={status} />, { locale: 'en' });
    expect(screen.getByText(text)).toBeVisible();
  });
});
