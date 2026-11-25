import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';
import { renderWithIntl } from './renderWithIntl';

const setup = (open = true, locale: 'pt-BR' | 'en' = 'pt-BR') => {
  const onClose = vi.fn();
  renderWithIntl(
    <Modal
      open={open}
      onClose={onClose}
      title="Pierre"
      subtitle="9:00–17:00"
      footer={<a href="/shops/pierre">Ver catálogo completo</a>}
    >
      <p>conteúdo</p>
    </Modal>,
    { locale },
  );
  return onClose;
};

describe('Modal', () => {
  it('should name the dialog after the title and show subtitle, body and footer', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Pierre' })).toBeInTheDocument();
    expect(screen.getByText('9:00–17:00')).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver catálogo completo' }),
    ).toBeInTheDocument();
  });

  it('should close from an icon-only button with a tooltip', async () => {
    const onClose = setup();
    const close = screen.getByRole('button', { name: 'Fechar' });
    expect(close).toHaveAttribute('title', 'Fechar');
    await userEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  it('should render nothing when closed', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should name the close button in English under the en locale', () => {
    setup(true, 'en');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute(
      'title',
      'Close',
    );
  });
});
