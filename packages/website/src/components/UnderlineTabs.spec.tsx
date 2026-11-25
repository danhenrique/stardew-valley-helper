import { render, screen } from '@testing-library/react';
import { UnderlineTabs } from './UnderlineTabs';

const TABS = [
  { id: 'plantios', label: 'Plantios' },
  { id: 'maquinas', label: 'Máquinas' },
] as const;

describe('UnderlineTabs', () => {
  it('should show the tabs without count badges when no counts are given', () => {
    render(
      <UnderlineTabs
        tabs={TABS}
        value="plantios"
        onChange={() => {}}
        navLabel="Abas"
        selectLabel="Escolha uma aba"
      />,
    );
    expect(screen.getByRole('button', { name: 'Plantios' })).toHaveTextContent(
      /^Plantios$/,
    );
    expect(screen.getByRole('option', { name: 'Plantios' })).toHaveTextContent(
      /^Plantios$/,
    );
  });

  it('should keep the count badges when counts are given', () => {
    render(
      <UnderlineTabs
        tabs={TABS}
        value="plantios"
        counts={{ plantios: 3, maquinas: 1 }}
        onChange={() => {}}
        navLabel="Abas"
        selectLabel="Escolha uma aba"
      />,
    );
    expect(
      screen.getByRole('option', { name: 'Plantios (3)' }),
    ).toBeInTheDocument();
  });
});
