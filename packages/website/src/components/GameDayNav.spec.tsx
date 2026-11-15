import {
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Season } from '../generated/stardew-valley-api/types.gen';
import { MAX_YEAR } from '../lib/gameDate';
import { GameDayNav } from './GameDayNav';

const profile = (
  year: number,
  season: Season,
  day: number,
  agriculturist = false,
) => ({ currentDate: { year, season, day }, agriculturist });

const openEditor = async () => {
  await userEvent.click(
    screen.getByRole('button', { name: /Alterar dia e progresso/ }),
  );
  return screen.findByRole('dialog', { name: 'Dia e progresso' });
};

describe('GameDayNav', () => {
  it('should show the current date', () => {
    render(<GameDayNav profile={profile(2, 'spring', 12)} onSave={vi.fn()} />);
    expect(screen.getByText('Primavera 12 · Ano 2')).toBeInTheDocument();
  });

  it('should save the next day keeping the profession', async () => {
    const onSave = vi.fn();
    render(
      <GameDayNav profile={profile(2, 'spring', 12, true)} onSave={onSave} />,
    );
    const next = screen.getByRole('button', { name: 'Próximo dia' });
    expect(next).toHaveAttribute('title', 'Próximo dia');
    await userEvent.click(next);
    expect(onSave).toHaveBeenCalledWith(profile(2, 'spring', 13, true));
  });

  it('should save the previous day with the icon button', async () => {
    const onSave = vi.fn();
    render(<GameDayNav profile={profile(2, 'spring', 12)} onSave={onSave} />);
    const back = screen.getByRole('button', { name: 'Dia anterior' });
    expect(back).toHaveAttribute('title', 'Dia anterior');
    await userEvent.click(back);
    expect(onSave).toHaveBeenCalledWith(profile(2, 'spring', 11));
  });

  it('should disable the previous day on spring 1 of year 1', () => {
    render(<GameDayNav profile={profile(1, 'spring', 1)} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dia anterior' })).toBeDisabled();
  });

  it('should roll winter 28 into spring 1 of the next year', async () => {
    const onSave = vi.fn();
    render(<GameDayNav profile={profile(1, 'winter', 28)} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo dia' }));
    expect(onSave).toHaveBeenCalledWith(profile(2, 'spring', 1));
  });

  it('should disable advancing on winter 28 of the max year', () => {
    render(
      <GameDayNav profile={profile(MAX_YEAR, 'winter', 28)} onSave={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeDisabled();
  });

  it('should keep the progress flags when advancing the day', async () => {
    const onSave = vi.fn();
    render(
      <GameDayNav
        profile={{ ...profile(2, 'spring', 12), communityCenterRestored: true }}
        onSave={onSave}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Próximo dia' }));
    expect(onSave).toHaveBeenCalledWith({
      ...profile(2, 'spring', 13),
      communityCenterRestored: true,
    });
  });

  it('should save edited values from the popover and close it', async () => {
    const onSave = vi.fn();
    render(<GameDayNav profile={profile(1, 'spring', 1)} onSave={onSave} />);
    const panel = await openEditor();
    const day = within(panel).getByRole('spinbutton', { name: 'Dia' });
    await userEvent.clear(day);
    await userEvent.type(day, '13');
    await userEvent.click(
      within(panel).getByRole('checkbox', { name: 'Profissão Agricultor' }),
    );
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Salvar' }),
    );
    expect(onSave).toHaveBeenCalledWith({
      ...profile(1, 'spring', 13, true),
      communityCenterRestored: false,
      keyToTown: false,
      boatRepaired: false,
    });
    await waitForElementToBeRemoved(panel);
  });

  it('should save the key to town flag keeping the other fields', async () => {
    const onSave = vi.fn();
    render(
      <GameDayNav
        profile={{
          ...profile(1, 'spring', 1, true),
          communityCenterRestored: true,
        }}
        onSave={onSave}
      />,
    );
    const panel = await openEditor();
    await userEvent.click(
      within(panel).getByRole('checkbox', { name: 'Chave da Cidade' }),
    );
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Salvar' }),
    );
    expect(onSave).toHaveBeenCalledWith({
      ...profile(1, 'spring', 1, true),
      communityCenterRestored: true,
      keyToTown: true,
      boatRepaired: false,
    });
  });

  it('should discard unsaved edits when the popover is reopened', async () => {
    render(<GameDayNav profile={profile(1, 'spring', 1)} onSave={vi.fn()} />);
    let panel = await openEditor();
    await userEvent.click(
      within(panel).getByRole('checkbox', { name: 'Chave da Cidade' }),
    );
    await userEvent.keyboard('{Escape}');
    await waitForElementToBeRemoved(panel);
    panel = await openEditor();
    expect(
      within(panel).getByRole('checkbox', { name: 'Chave da Cidade' }),
    ).not.toBeChecked();
  });

  describe('rain of the day', () => {
    const rainy = { ...profile(1, 'spring', 5), rainToday: true };

    it('should save rainToday true when the rain button is pressed', async () => {
      const onSave = vi.fn();
      render(<GameDayNav profile={profile(1, 'spring', 5)} onSave={onSave} />);
      const button = screen.getByRole('button', { name: 'Sem chuva hoje' });
      expect(button).toHaveAttribute('title', 'Sem chuva hoje');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      await userEvent.click(button);
      expect(onSave).toHaveBeenCalledWith({
        ...profile(1, 'spring', 5),
        rainToday: true,
      });
    });

    it('should show the pressed state when it rains', () => {
      render(<GameDayNav profile={rainy} onSave={vi.fn()} />);
      const button = screen.getByRole('button', { name: 'Chovendo hoje' });
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('title', 'Chovendo hoje');
    });

    it('should send rainToday false when stepping to the next day while it rains', async () => {
      const onSave = vi.fn();
      render(<GameDayNav profile={rainy} onSave={onSave} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'Próximo dia' }),
      );
      expect(onSave).toHaveBeenCalledWith({
        ...profile(1, 'spring', 6),
        rainToday: false,
      });
    });

    it('should send rainToday false when the day editor changes the date while it rains', async () => {
      const onSave = vi.fn();
      render(<GameDayNav profile={rainy} onSave={onSave} />);
      const panel = await openEditor();
      const day = within(panel).getByRole('spinbutton', { name: 'Dia' });
      await userEvent.clear(day);
      await userEvent.type(day, '9');
      await userEvent.click(
        within(panel).getByRole('button', { name: 'Salvar' }),
      );
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          currentDate: { year: 1, season: 'spring', day: 9 },
          rainToday: false,
        }),
      );
    });

    it('should keep the rain when the day editor saves only flags', async () => {
      const onSave = vi.fn();
      render(<GameDayNav profile={rainy} onSave={onSave} />);
      const panel = await openEditor();
      await userEvent.click(
        within(panel).getByRole('checkbox', { name: 'Chave da Cidade' }),
      );
      await userEvent.click(
        within(panel).getByRole('button', { name: 'Salvar' }),
      );
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ keyToTown: true, rainToday: true }),
      );
    });

    it('should flip from the latest profile when clicked twice', async () => {
      const onSave = vi.fn();
      const { rerender } = render(
        <GameDayNav profile={profile(1, 'spring', 5)} onSave={onSave} />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Sem chuva hoje' }),
      );
      rerender(
        <GameDayNav profile={onSave.mock.calls[0][0]} onSave={onSave} />,
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Chovendo hoje' }),
      );
      expect(onSave.mock.calls.map(([p]) => p.rainToday)).toEqual([
        true,
        false,
      ]);
    });
  });
});
