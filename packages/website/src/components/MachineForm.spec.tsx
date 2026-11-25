import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { iconUrl } from '../lib/icons';
import { MachineForm } from './MachineForm';
import { renderWithIntl } from './renderWithIntl';
import { MACHINES, SPRING_1 } from './testData';

const renderForm = (props: Partial<Parameters<typeof MachineForm>[0]> = {}) => {
  const onSubmit = vi.fn();
  const onDraftChange = vi.fn();
  renderWithIntl(
    <>
      <MachineForm
        formId="test-form"
        today={SPRING_1}
        machines={MACHINES}
        onSubmit={onSubmit}
        onDraftChange={onDraftChange}
        {...props}
      />
      <button type="submit" form="test-form">
        Enviar
      </button>
    </>,
  );
  return { onSubmit, onDraftChange };
};

const choose = async (label: string, option: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: new RegExp(`^${label}`) }),
  );
  await userEvent.click(
    screen.getByRole('option', { name: new RegExp(`^${option}`) }),
  );
};

const follows = (first: HTMLElement, second: HTMLElement) =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

describe('MachineForm', () => {
  it('should show Máquina, Produto, Início and Quantidade de máquinas in order', () => {
    renderForm();
    const fields = [
      'Máquina',
      'Produto',
      'Início',
      'Quantidade de máquinas',
    ].map((text) => screen.getByText(text));
    for (let i = 1; i < fields.length; i++)
      expect(follows(fields[i - 1], fields[i])).toBe(true);
    expect(screen.getByText('Hoje (Primavera 1, Ano 1)')).toBeInTheDocument();
  });

  it('should list the products with their days and mark approximate ones', async () => {
    renderForm();
    await choose('Máquina', 'Barril$');
    await userEvent.click(screen.getByRole('button', { name: /^Produto/ }));
    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['Vinho Teste7 dias', 'Suco Teste2 dias · aprox.']);
  });

  it('should ask for the starting quality only for the cask, defaulting to Normal', async () => {
    const { onDraftChange } = renderForm();
    expect(
      screen.queryByRole('button', { name: /^Qualidade inicial/ }),
    ).not.toBeInTheDocument();
    await choose('Máquina', 'Barril de Envelhecimento');
    expect(
      screen.getByRole('button', { name: /^Qualidade inicial/ }),
    ).toHaveTextContent('Normal');
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ machineId: 'cask', startQuality: 'normal' }),
    );
    await choose('Qualidade inicial', 'Prata');
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ startQuality: 'silver' }),
    );
  });

  it('should show the single bee house product as text and ask for Fazenda or Ilha Gengibre', async () => {
    const { onDraftChange } = renderForm();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await choose('Máquina', 'Colmeia');
    expect(screen.getByText('Mel Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Produto/ }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Fazenda', 'Ilha Gengibre']);
    expect(screen.getByRole('radio', { name: 'Fazenda' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Ilha Gengibre' }));
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        machineId: 'bee-house',
        outputId: 'test-honey',
        location: 'ginger-island',
        startQuality: null,
      }),
    );
  });

  it('should not ask for a product right after the first machine pick', async () => {
    const { onDraftChange } = renderForm();
    await choose('Máquina', 'Barril$');
    expect(
      screen.queryByText('Escolha um produto desta máquina'),
    ).not.toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
  });

  it('should keep quantity and start date and ask for a product when the machine changes', async () => {
    const { onDraftChange } = renderForm();
    await choose('Máquina', 'Barril$');
    await choose('Produto', 'Vinho Teste');
    const quantity = screen.getByRole('spinbutton', {
      name: 'Quantidade de máquinas',
    });
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Outra data' }));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo dia' }));
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ outputId: 'test-wine', quantity: 3 }),
    );

    await choose('Máquina', 'Jarra de Conservas');

    const issue = screen.getByText('Escolha um produto desta máquina');
    expect(screen.getByRole('button', { name: /^Produto/ })).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(issue.id),
    );
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByRole('spinbutton', { name: 'Quantidade de máquinas' }),
    ).toHaveValue(3);
    expect(screen.getByRole('spinbutton', { name: 'Dia' })).toHaveValue(2);
  });

  it('should submit the full machine batch when the form is complete', async () => {
    const { onSubmit } = renderForm();
    await choose('Máquina', 'Barril$');
    await choose('Produto', 'Vinho Teste');
    await userEvent.click(screen.getByRole('button', { name: 'Mais opções' }));
    await userEvent.type(screen.getByRole('textbox'), 'Adega');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledWith({
      machineId: 'keg',
      outputId: 'test-wine',
      startedOn: SPRING_1,
      quantity: 1,
      startQuality: null,
      location: 'farm',
      label: 'Adega',
    });
  });

  it('should pre-fill every field when editing', () => {
    renderForm({
      initial: {
        machineId: 'keg',
        outputId: 'test-juice',
        startedOn: { year: 1, season: 'summer', day: 4 },
        quantity: 5,
        startQuality: null,
        location: 'farm',
        label: null,
      },
    });
    expect(screen.getByRole('button', { name: /^Máquina/ })).toHaveTextContent(
      'Barril',
    );
    expect(screen.getByRole('button', { name: /^Produto/ })).toHaveTextContent(
      'Suco Teste',
    );
    expect(screen.getByRole('spinbutton', { name: 'Dia' })).toHaveValue(4);
    expect(
      screen.getByRole('spinbutton', { name: 'Quantidade de máquinas' }),
    ).toHaveValue(5);
  });

  it('should show the machine sprite in the machine options and on the chosen machine', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /^Máquina/ }));
    expect(
      screen.getByRole('option', { name: /^Barril$/ }).querySelector('img'),
    ).toHaveAttribute('src', iconUrl('keg'));
    await userEvent.click(screen.getByRole('option', { name: /^Barril$/ }));
    expect(
      screen.getByRole('button', { name: /^Máquina/ }).querySelector('img'),
    ).toHaveAttribute('src', iconUrl('keg'));
  });
});

describe('MachineForm in English', () => {
  const renderEnglish = () =>
    renderWithIntl(
      <MachineForm
        formId="test-form"
        today={SPRING_1}
        machines={MACHINES}
        onSubmit={vi.fn()}
      />,
      { locale: 'en' },
    );

  it('should show the field labels and today in English', () => {
    renderEnglish();
    for (const text of ['Machine', 'Product', 'Start', 'Number of machines'])
      expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText('Today (Spring 1, Year 1)')).toBeInTheDocument();
    expect(screen.getByText('Choose the machine first')).toBeInTheDocument();
  });

  it('should list the products with their days in English', async () => {
    renderEnglish();
    await userEvent.click(screen.getByRole('button', { name: /^Machine/ }));
    await userEvent.click(screen.getByRole('option', { name: /^Keg$/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Product/ }));
    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(
      options.some((text) => /Test Wine.*\d+ days?/.test(text ?? '')),
    ).toBe(true);
  });

  it('should show the starting quality in English for an aging machine', async () => {
    renderEnglish();
    await userEvent.click(screen.getByRole('button', { name: /^Machine/ }));
    await userEvent.click(screen.getByRole('option', { name: /^Cask$/ }));
    expect(
      screen.getByRole('button', { name: /^Starting quality/ }),
    ).toHaveTextContent('Normal');
  });
});
