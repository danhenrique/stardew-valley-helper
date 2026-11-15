import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../ThemeProvider';
import { ThemeToggle } from '.';

const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark', 'light');
});

describe('ThemeToggle', () => {
  it('should start in automatic mode when nothing is stored', () => {
    renderToggle();
    const button = screen.getByRole('button', {
      name: 'Tema automático (alternar para claro)',
    });
    expect(button).toHaveAttribute(
      'title',
      'Tema automático (alternar para claro)',
    );
  });

  it('should cycle automatic, light, dark and back when clicked', async () => {
    renderToggle();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button'));
    expect(
      screen.getByRole('button', { name: 'Tema claro (alternar para escuro)' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(screen.getByRole('button'));
    expect(
      screen.getByRole('button', {
        name: 'Tema escuro (alternar para automático)',
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');

    await user.click(screen.getByRole('button'));
    expect(
      screen.getByRole('button', {
        name: 'Tema automático (alternar para claro)',
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('theme')).toBe('system');
  });

  it('should restore the stored choice when rendered', () => {
    localStorage.setItem('theme', 'dark');
    renderToggle();
    expect(
      screen.getByRole('button', {
        name: 'Tema escuro (alternar para automático)',
      }),
    ).toBeInTheDocument();
  });
});
