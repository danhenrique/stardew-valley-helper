import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['growing', 'Crescendo'],
    ['ready', 'Pronta'],
    ['regrowing', 'Rebrotando'],
    ['finished', 'Finalizada'],
    ['dead', 'Morta'],
  ] as const)('should show %s as %s', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
