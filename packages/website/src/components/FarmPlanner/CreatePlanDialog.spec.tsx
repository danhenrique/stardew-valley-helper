import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '../../lib/locale';
import { renderWithIntl } from '../renderWithIntl';
import { CreatePlanDialog } from './CreatePlanDialog';

const farms = [
  { id: 'standard', label: 'Padrão' },
  { id: 'forest', label: 'Floresta' },
];

const setup = (locale?: Locale) => {
  const onCreate = vi.fn();
  renderWithIntl(
    <CreatePlanDialog
      open
      farms={farms}
      pending={false}
      onClose={vi.fn()}
      onCreate={onCreate}
    />,
    { locale },
  );
  return { onCreate, dialog: screen.getByRole('dialog') };
};

describe('CreatePlanDialog', () => {
  afterEach(() => cleanup());

  it('should render the farm options outside the dialog panel when the select opens', async () => {
    const { dialog } = setup();
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Fazenda/ }),
    );
    const listbox = await screen.findByRole('listbox');
    const panel = dialog.querySelector('[id^="headlessui-dialog-panel-"]');
    expect(panel).not.toBeNull();
    // Portalled out of the panel, so its overflow cannot clip the options.
    expect(panel?.contains(listbox)).toBe(false);
  });

  it('should create the plan with the picked farm when an option is chosen', async () => {
    const { dialog, onCreate } = setup();
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Ano 1');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Fazenda/ }),
    );
    await userEvent.click(
      await screen.findByRole('option', { name: 'Floresta' }),
    );
    expect(
      within(dialog).getByRole('button', { name: /Fazenda/ }),
    ).toHaveTextContent('Floresta');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Criar' }),
    );
    expect(onCreate).toHaveBeenCalledWith({ name: 'Ano 1', farmId: 'forest' });
  });

  it('should translate the form in English', () => {
    const { dialog } = setup('en');
    expect(within(dialog).getByText('New plan')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Up to 60 characters.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Create' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toBeInTheDocument();
  });
});
