import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemDrawer } from './ItemDrawer';

const setup = (open = true) => {
  const onClose = vi.fn();
  render(
    <ItemDrawer
      open={open}
      title="Adicionar plantio"
      onClose={onClose}
      footer={<button type="button">Salvar</button>}
    >
      <p>conteúdo</p>
    </ItemDrawer>,
  );
  return onClose;
};

describe('ItemDrawer', () => {
  it('should render the title as the dialog name with body and footer', () => {
    setup();
    expect(
      screen.getByRole('dialog', { name: 'Adicionar plantio' }),
    ).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('should call onClose from the close button', async () => {
    const onClose = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose on Escape', async () => {
    const onClose = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('should render nothing when closed', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
