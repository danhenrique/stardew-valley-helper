import { screen } from '@testing-library/react';
import { renderWithIntl } from './renderWithIntl';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['growing', 'Crescendo'],
    ['ready', 'Pronta'],
    ['regrowing', 'Rebrotando'],
    ['finished', 'Finalizada'],
    ['dead', 'Morta'],
  ] as const)('should show %s as %s', (status, label) => {
    renderWithIntl(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
