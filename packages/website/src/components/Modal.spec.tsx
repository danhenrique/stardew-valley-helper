import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

const setup = (open = true) => {
  const onClose = vi.fn();
  render(
    <Modal
      open={open}
      onClose={onClose}
      title="Pierre"
      subtitle="9:00–17:00"
      footer={<a href="/lojas/pierre">Ver catálogo completo</a>}
    >
      <p>conteúdo</p>
    </Modal>,
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
});
