import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_YEAR } from '../../lib/gameDate';
import { GameDateFields } from './GameDateFields';

describe('GameDateFields', () => {
  it('should mark Próximo dia as aria-disabled at the last day of the last year', async () => {
    const onChange = vi.fn();
    render(
      <GameDateFields
        legend="Data"
        value={{ year: MAX_YEAR, season: 'winter', day: 28 }}
        onChange={onChange}
      />,
    );
    const next = screen.getByRole('button', { name: 'Próximo dia' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('button', { name: 'Dia anterior' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should mark Dia anterior as aria-disabled at year 1 spring 1', async () => {
    const onChange = vi.fn();
    render(
      <GameDateFields
        legend="Data"
        value={{ year: 1, season: 'spring', day: 1 }}
        onChange={onChange}
      />,
    );
    const previous = screen.getByRole('button', { name: 'Dia anterior' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('button', { name: 'Próximo dia' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(previous);
    expect(onChange).not.toHaveBeenCalled();
  });
});
