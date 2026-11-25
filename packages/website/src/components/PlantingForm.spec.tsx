import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { iconUrl } from '../lib/icons';
import { PlantingForm } from './PlantingForm';
import { renderWithIntl } from './renderWithIntl';
import { FERTILIZERS, PLANTABLES, SPRING_1 } from './testData';

const renderForm = (
  props: Partial<Parameters<typeof PlantingForm>[0]> = {},
) => {
  const onSubmit = vi.fn();
  const onDraftChange = vi.fn();
  renderWithIntl(
    <>
      <PlantingForm
        formId="test-form"
        today={SPRING_1}
        plantables={PLANTABLES}
        fertilizers={FERTILIZERS}
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

const openSeeds = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: /Mostrar sementes/ }),
  );
  return screen.getAllByRole('option').map((option) => option.textContent);
};

const pick = async (name: RegExp) => {
  await openSeeds();
  await userEvent.click(screen.getByRole('option', { name }));
};

const choose = async (label: string, option: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: new RegExp(`^${label}`) }),
  );
  await userEvent.click(
    screen.getByRole('option', { name: new RegExp(option) }),
  );
};

const openMore = () =>
  userEvent.click(screen.getByRole('button', { name: 'Mais opções' }));

describe('PlantingForm', () => {
  it.each([
    ['Dia', '30', 'day', 28],
    ['Ano', '1000', 'year', 999],
  ])(
    'should submit the snapped value when %s is typed as %s and the form is sent',
    async (field, typed, key, expected) => {
      const { onSubmit } = renderForm();
      await pick(/Sementes de Fruta/);
      await userEvent.click(screen.getByRole('button', { name: 'Outra data' }));
      const input = screen.getByRole('spinbutton', { name: field });
      await userEvent.clear(input);
      await userEvent.type(input, `${typed}{Enter}`);
      await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0].plantedOn[key]).toBe(expected);
      expect(input).toHaveValue(expected);
    },
  );

  it('should list all plantables including out-of-season ones with a badge', async () => {
    renderForm();
    const options = await openSeeds();
    expect(options).toHaveLength(PLANTABLES.length);
    const melon = options.find((text) => text?.includes('Sementes de Melão'));
    expect(melon).toContain('Fora da estação');
    expect(
      options.find((text) => text?.includes('Sementes de Fruta')),
    ).not.toContain('Fora da estação');
  });

  it('should keep the seed when the location changes', async () => {
    renderForm();
    await pick(/Sementes de Fruta/);
    await userEvent.click(screen.getByRole('radio', { name: 'Estufa' }));
    expect(screen.getByRole('combobox')).toHaveValue('Sementes de Fruta');
  });

  it('should keep the seed when the date changes to another season', async () => {
    renderForm();
    await pick(/Sementes de Fruta/);
    await userEvent.click(screen.getByRole('button', { name: 'Outra data' }));
    await choose('Estação', 'Verão');
    expect(screen.getByRole('combobox')).toHaveValue('Sementes de Fruta');
  });

  it('should show the inline issue and emit a null draft for an out-of-season seed', async () => {
    const { onDraftChange } = renderForm();
    await pick(/Sementes de Melão/);
    expect(
      screen.getByText('Fora da estação na Fazenda — use Estufa ou Ilha'),
    ).toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
    const issue = screen.getByText(
      'Fora da estação na Fazenda — use Estufa ou Ilha',
    );
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-describedby',
      issue.id,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Estufa' }));
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seedId: 'test-melon-seeds' }),
    );
  });

  it('should default the date to today and reveal the fields on Outra data', async () => {
    renderForm();
    expect(screen.getByText('Hoje (Primavera 1, Ano 1)')).toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', { name: 'Dia' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Outra data' }));
    expect(screen.getByRole('spinbutton', { name: 'Dia' })).toBeInTheDocument();
  });

  it('should hide fertilizer and nickname behind Mais opções', async () => {
    renderForm();
    expect(
      screen.queryByRole('button', { name: /^Fertilizante/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await openMore();
    expect(
      screen.getByRole('button', { name: /^Fertilizante/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'label');
  });

  it('should submit a camelCase payload when the form is complete', async () => {
    const { onSubmit } = renderForm();
    await pick(/Sementes de Fruta/);
    await openMore();
    await choose('Fertilizante', 'Solo Foliar Premium');
    const quantity = screen.getByRole('spinbutton', { name: 'Quantidade' });
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '250');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledWith({
      seedId: 'test-berry-seeds',
      anchor: 'planted',
      plantedOn: SPRING_1,
      lastHarvestOn: null,
      fertilizer: 'deluxe-speed-gro',
      location: 'farm',
      quantity: 250,
      label: null,
    });
  });

  it('should accept quantities from 1 to 999', () => {
    renderForm();
    const quantity = screen.getByRole('spinbutton', { name: 'Quantidade' });
    expect(quantity).toHaveAttribute('min', '1');
    expect(quantity).toHaveAttribute('max', '999');
    expect(quantity).toHaveValue(1);
  });

  it('should not submit when no seed is selected', async () => {
    const { onSubmit, onDraftChange } = renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
  });

  it('should enable the harvest toggle only for regrowing crops', async () => {
    const { onSubmit } = renderForm();
    await openMore();
    await pick(/Flower Seeds/);
    const toggle = screen.getByRole('checkbox', {
      name: 'Sei só a data de uma colheita',
    });
    expect(toggle).toBeDisabled();
    await pick(/Sementes de Fruta/);
    expect(toggle).toBeEnabled();
    await userEvent.click(toggle);
    expect(screen.getByText('Data da colheita')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Fertilizante/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        anchor: 'harvested',
        plantedOn: null,
        lastHarvestOn: SPRING_1,
        fertilizer: 'none',
      }),
    );
  });

  it('should prefill the fields when editing an existing planting', () => {
    renderForm({
      initial: {
        seedId: 'test-berry-seeds',
        anchor: 'planted',
        plantedOn: SPRING_1,
        lastHarvestOn: null,
        fertilizer: 'none',
        location: 'farm',
        quantity: 1,
        label: null,
      },
    });
    expect(screen.getByRole('combobox')).toHaveValue('Sementes de Fruta');
  });

  it('should show the seed sprite in the options and next to the chosen seed', async () => {
    renderForm({ plantables: [{ ...PLANTABLES[0], id: 'parsnip-seeds' }] });
    await openSeeds();
    expect(
      screen
        .getByRole('option', { name: /Sementes de Fruta/ })
        .querySelector('img'),
    ).toHaveAttribute('src', iconUrl('parsnip-seeds'));
    await userEvent.click(
      screen.getByRole('option', { name: /Sementes de Fruta/ }),
    );
    expect(
      screen
        .getByRole('combobox', { name: 'Semente ou muda' })
        .parentElement?.querySelector('img'),
    ).toHaveAttribute('src', iconUrl('parsnip-seeds'));
  });

  it('should show the fertilizer sprite in the fertilizer options', async () => {
    renderForm();
    await openMore();
    await userEvent.click(
      screen.getByRole('button', { name: /^Fertilizante/ }),
    );
    const option = screen
      .getAllByRole('option')
      .find((o) => o.querySelector('img'));
    expect(option?.querySelector('img')?.getAttribute('src')).toMatch(
      /\/icons\/.+\.png$/,
    );
  });
});

describe('PlantingForm in English', () => {
  const renderEnglish = () =>
    renderWithIntl(
      <PlantingForm
        formId="test-form"
        today={SPRING_1}
        plantables={PLANTABLES}
        fertilizers={FERTILIZERS}
        onSubmit={vi.fn()}
      />,
      { locale: 'en' },
    );

  it('should show the field labels and today in English', () => {
    renderEnglish();
    expect(screen.getByText('Seed or sapling')).toBeInTheDocument();
    expect(screen.getByText('Planting date')).toBeInTheDocument();
    expect(screen.getByText('Today (Spring 1, Year 1)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Other date' })).toBeVisible();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('should mark an out-of-season seed with one translated message', async () => {
    renderEnglish();
    await userEvent.click(screen.getByRole('button', { name: /Show seeds/ }));
    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options.find((text) => text?.includes('Melon Seeds'))).toContain(
      '· Out of season',
    );
    expect(options.find((text) => text?.includes('Berry Seeds'))).not.toContain(
      'Out of season',
    );
  });

  it('should show the more options in English', async () => {
    renderEnglish();
    await userEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByText('Fertilizer')).toBeInTheDocument();
    expect(
      screen.getByText('I only know the date of a harvest'),
    ).toBeInTheDocument();
    expect(screen.getByText('For regrowing crops')).toBeInTheDocument();
    expect(screen.getByText('Nickname (optional)')).toBeInTheDocument();
  });
});
