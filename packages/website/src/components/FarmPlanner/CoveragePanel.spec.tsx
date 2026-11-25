import { screen } from '@testing-library/react';
import { renderWithIntl } from '../renderWithIntl';
import { CoveragePanel } from './CoveragePanel';

const summary = {
  tilled: 10,
  watered: 5,
  protected: 3,
  dry: [1, 2],
  unprotected: [4],
};

describe('CoveragePanel', () => {
  it('should count tilled, watered and protected tiles in Portuguese', () => {
    renderWithIntl(<CoveragePanel summary={summary} onShowTile={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Cobertura' })).toBeVisible();
    expect(screen.getByText('Tiles arados: 10')).toBeVisible();
    expect(screen.getByText('Regados: 5 (50%)')).toBeVisible();
    expect(
      screen.getByRole('button', { name: '2 tiles sem água' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: '1 tile sem proteção' }),
    ).toBeVisible();
  });

  it('should count tilled, watered and protected tiles in English', () => {
    renderWithIntl(<CoveragePanel summary={summary} onShowTile={vi.fn()} />, {
      locale: 'en',
    });
    expect(screen.getByRole('region', { name: 'Coverage' })).toBeVisible();
    expect(screen.getByText('Tilled tiles: 10')).toBeVisible();
    expect(screen.getByText('Watered: 5 (50%)')).toBeVisible();
    expect(screen.getByText('Protected: 3 (30%)')).toBeVisible();
    expect(
      screen.getByRole('button', { name: '2 tiles unwatered' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: '1 tile unprotected' }),
    ).toBeVisible();
  });

  it('should say nothing is tilled yet in English', () => {
    renderWithIntl(
      <CoveragePanel
        summary={{ ...summary, tilled: 0, dry: [], unprotected: [] }}
        onShowTile={vi.fn()}
      />,
      { locale: 'en' },
    );
    expect(screen.getByText('No tilled tiles yet')).toBeVisible();
  });
});
