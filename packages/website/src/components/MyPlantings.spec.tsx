import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyPlantings } from './MyPlantings';
import { BERRY_PLANTING, MELON_GREENHOUSE_PLANTING, NAMES } from './testData';

const renderPlantings = () =>
  render(
    <MyPlantings
      plantings={[BERRY_PLANTING, MELON_GREENHOUSE_PLANTING]}
      names={NAMES}
      today={{ year: 1, season: 'spring', day: 1 }}
      onEdit={vi.fn()}
      onReplant={vi.fn()}
      onRemove={vi.fn()}
      canReplant={() => false}
    />,
  );

const list = () => screen.getByRole('list', { name: 'Plantios' });

describe('MyPlantings', () => {
  it('should show every planting with its location when the Todos tab is selected', () => {
    renderPlantings();
    expect(screen.getByRole('button', { name: /^Todos/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(list()).getByText('Sementes de Fruta')).toBeInTheDocument();
    expect(within(list()).getByText('Sementes de Melão')).toBeInTheDocument();
    expect(within(list()).getByText('Fazenda')).toBeInTheDocument();
    expect(within(list()).getByText('Estufa')).toBeInTheDocument();
  });

  it('should show how many plantings each location has', () => {
    renderPlantings();
    expect(screen.getByRole('button', { name: 'Todos 2' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Fazenda 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Estufa 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ilha Gengibre 0' }),
    ).toBeInTheDocument();
  });

  it('should list only greenhouse plantings when the Estufa tab is clicked', async () => {
    renderPlantings();
    await userEvent.click(screen.getByRole('button', { name: /^Estufa/ }));
    expect(within(list()).getByText('Sementes de Melão')).toBeInTheDocument();
    expect(
      within(list()).queryByText('Sementes de Fruta'),
    ).not.toBeInTheDocument();
  });

  it('should show the location empty state when a tab has no plantings', async () => {
    renderPlantings();
    await userEvent.click(
      screen.getByRole('button', { name: /^Ilha Gengibre/ }),
    );
    expect(
      screen.getByText('Nenhum plantio na Ilha Gengibre'),
    ).toBeInTheDocument();
  });

  it('should show only the selected location in the harvest calendar', async () => {
    renderPlantings();
    await userEvent.click(screen.getByRole('button', { name: /^Estufa/ }));
    expect(
      within(screen.getByTestId('calendar-day-9')).queryByText(
        'Sementes de Fruta',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('calendar-day-9')).getByText(
        'Sementes de Melão',
      ),
    ).toBeInTheDocument();
  });

  it('should switch location with the mobile select', async () => {
    renderPlantings();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Escolher local' }),
      'greenhouse',
    );
    expect(
      within(list()).queryByText('Sementes de Fruta'),
    ).not.toBeInTheDocument();
  });
});
