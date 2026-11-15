import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberStepper } from './NumberStepper';

const setup = (value = 5, onChange = vi.fn()) => {
  render(
    <NumberStepper
      label="Dia"
      value={value}
      min={1}
      max={28}
      onChange={onChange}
    />,
  );
  return { onChange, input: screen.getByRole('spinbutton', { name: 'Dia' }) };
};

describe('NumberStepper', () => {
  it('should call onChange with 13 when 13 is typed', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '13');
    expect(onChange).toHaveBeenLastCalledWith(13);
  });

  it('should not call onChange and snap to max on blur when 40 is typed (intermediate 4 is valid)', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '40');
    expect(onChange).not.toHaveBeenCalledWith(40);
    await userEvent.tab();
    expect(input).toHaveValue(28);
  });

  it('should restore the last valid value when cleared and blurred', async () => {
    const { input } = setup(7);
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue(7);
  });

  it('should call onChange with value plus or minus one when buttons are clicked', async () => {
    const { onChange } = setup(5);
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar Dia' }));
    expect(onChange).toHaveBeenLastCalledWith(6);
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir Dia' }));
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('should mark decrease as aria-disabled at min and ignore clicks', async () => {
    const { onChange } = setup(1);
    const button = screen.getByRole('button', { name: 'Diminuir Dia' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should mark increase as aria-disabled at max and ignore clicks', async () => {
    const { onChange } = setup(28);
    const button = screen.getByRole('button', { name: 'Aumentar Dia' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should keep focus on the increase button when it reaches max', async () => {
    const onChange = vi.fn();
    const props = { label: 'Dia', min: 1, max: 28, onChange };
    const { rerender } = render(<NumberStepper {...props} value={27} />);
    const button = screen.getByRole('button', { name: 'Aumentar Dia' });
    await userEvent.click(button);
    rerender(<NumberStepper {...props} value={28} />);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
  });

  it('should snap to max and emit it when Enter is pressed on an out-of-range value', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '40{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(28);
    expect(input).toHaveValue(28);
  });

  it('should emit onChange with max when an out-of-range value is blurred', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '40');
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(28);
  });

  it('should emit onChange with min when a value below min is blurred', async () => {
    const { onChange, input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(input).toHaveValue(1);
  });

  it('should resync the text when value changes from outside during an edit', async () => {
    const onChange = vi.fn();
    const props = { label: 'Dia', min: 1, max: 28, onChange };
    const { rerender } = render(<NumberStepper {...props} value={5} />);
    const input = screen.getByRole('spinbutton', { name: 'Dia' });
    await userEvent.clear(input);
    await userEvent.type(input, '4');
    rerender(<NumberStepper {...props} value={9} />);
    expect(input).toHaveValue(9);
  });
});
