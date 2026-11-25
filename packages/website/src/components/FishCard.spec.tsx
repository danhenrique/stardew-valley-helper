import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FishCard } from './FishCard';
import { renderWithIntl } from './renderWithIntl';
import { FISH } from './testData';

const byId = (id: string) => FISH.find((f) => f.id === id)!;

describe('FishCard', () => {
  it('should show name, location, seasons and hour text when rendered', () => {
    renderWithIntl(<FishCard fish={byId('test-rod-fish')} />);
    expect(screen.getByText('Peixe Teste')).toBeInTheDocument();
    expect(screen.getByText('Rio')).toBeInTheDocument();
    expect(screen.getByText('Primavera')).toBeInTheDocument();
    expect(screen.getByText('Verão')).toBeInTheDocument();
    expect(screen.getByText('06:00–19:00')).toBeInTheDocument();
  });

  it('should label the weather when the fish needs rain or sun', () => {
    const { rerender } = renderWithIntl(
      <FishCard fish={byId('test-rain-only')} />,
    );
    expect(screen.getByTitle('Só com chuva')).toBeInTheDocument();
    rerender(<FishCard fish={byId('test-two-windows')} />);
    expect(screen.getByTitle('Só com sol')).toBeInTheDocument();
    rerender(<FishCard fish={byId('test-rod-fish')} />);
    expect(screen.queryByTitle(/Só com/)).not.toBeInTheDocument();
  });

  it('should position the hour segments when the fish has two windows', () => {
    renderWithIntl(<FishCard fish={byId('test-two-windows')} />);
    const segments = screen.getAllByTestId('fish-window');
    expect(segments.map((s) => [s.style.left, s.style.width])).toEqual([
      ['0%', '25%'],
      ['60%', '40%'],
    ]);
    expect(screen.getByText('06:00–11:00 · 18:00–02:00')).toBeInTheDocument();
  });

  it('should call onSelect when the card is clicked', async () => {
    const onSelect = vi.fn();
    renderWithIntl(<FishCard fish={byId('test-crab')} onSelect={onSelect} />);
    await userEvent.click(
      screen.getByRole('button', { name: /Caranguejo Teste/ }),
    );
    expect(onSelect).toHaveBeenCalledWith(byId('test-crab'));
  });
});

describe('FishCard in English', () => {
  it('should show the English name, location, seasons and weather labels', () => {
    const { rerender } = renderWithIntl(
      <FishCard fish={byId('test-rain-only')} />,
      { locale: 'en' },
    );
    expect(screen.getByTitle('Rain only')).toBeInTheDocument();
    rerender(<FishCard fish={byId('test-rod-fish')} />);
    expect(screen.getByText('River')).toBeInTheDocument();
    expect(screen.getByText('Spring')).toBeInTheDocument();
    rerender(<FishCard fish={byId('test-two-windows')} />);
    expect(screen.getByTitle('Sun only')).toBeInTheDocument();
  });
});
