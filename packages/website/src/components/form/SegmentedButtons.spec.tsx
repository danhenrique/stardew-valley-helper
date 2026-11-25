import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedButtons } from './SegmentedButtons';

const OPTIONS = [
  { value: 'season', label: 'Estação inteira' },
  { value: 'today', label: 'A partir de hoje', disabled: false },
];

describe('SegmentedButtons', () => {
  it('should mark only the selected option as pressed when rendered', () => {
    render(
      <SegmentedButtons
        label="Período"
        options={OPTIONS}
        value="today"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Período' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'A partir de hoje' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Estação inteira' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('should call onChange with the value when an option is clicked', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedButtons
        label="Período"
        options={OPTIONS}
        value="today"
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Estação inteira' }),
    );
    expect(onChange).toHaveBeenCalledWith('season');
  });

  it('should not call onChange when a disabled option is clicked', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedButtons
        label="Período"
        options={[OPTIONS[0], { ...OPTIONS[1], disabled: true }]}
        value="season"
        onChange={onChange}
      />,
    );
    const today = screen.getByRole('button', { name: 'A partir de hoje' });
    expect(today).toBeDisabled();
    await userEvent.click(today);
    expect(onChange).not.toHaveBeenCalled();
  });
});
