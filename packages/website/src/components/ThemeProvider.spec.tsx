import { render } from '@testing-library/react';
import { ThemeProvider } from './ThemeProvider';

describe('ThemeProvider', () => {
  it('should render without React script-tag errors', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );
    expect(
      error.mock.calls.some(([message]) =>
        String(message).includes('Encountered a script tag'),
      ),
    ).toBe(false);
  });
});
