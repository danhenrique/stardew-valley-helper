import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { MAX_OBJECTS, type PlacedObject } from '../../lib/farmPlanner/types';
import type { Locale } from '../../lib/locale';
import { renderWithIntl } from '../renderWithIntl';
import {
  catalog,
  clickTile,
  dragTiles,
  FARMHOUSE,
  hoverTile,
  planWith,
  terrain,
} from './editorFixtures.spec-helpers';
import { FarmEditor, type FarmEditorHandle } from './FarmEditor';
import { TILE_PX } from './useViewport';

const setup = (objects: PlacedObject[] = [FARMHOUSE], locale?: Locale) => {
  const onChange = vi.fn();
  renderWithIntl(
    <FarmEditor
      plan={planWith(objects)}
      terrain={terrain}
      catalog={catalog}
      onChange={onChange}
    />,
    { locale },
  );
  return {
    onChange,
    map: screen.getByRole('application', {
      name: locale === 'en' ? 'Farm map' : 'Mapa da fazenda',
    }),
  };
};

const palette = () => screen.getByRole('region', { name: 'Objetos' });
const pick = (name: string) =>
  userEvent.click(within(palette()).getByRole('button', { name }));
const details = () => screen.getByRole('region', { name: 'Detalhes' });
const lastObjects = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.at(-1)?.[0] as PlacedObject[];

describe('FarmEditor', () => {
  it('should place the picked building on a free buildable tile', async () => {
    const { onChange, map } = setup();
    await pick('Celeiro');
    clickTile(map, 3, 3);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastObjects(onChange)).toEqual([
      FARMHOUSE,
      { t: 'barn', x: 3, y: 3 },
    ]);
  });

  it('should refuse a building on water and say why', async () => {
    const { onChange, map } = setup();
    await pick('Celeiro');
    clickTile(map, 6, 0);
    expect(onChange).not.toHaveBeenCalled();
    expect(
      within(details()).getByText('Terreno bloqueado'),
    ).toBeInTheDocument();
  });

  it('should translate the panels and the refusal reason in English', async () => {
    const { onChange, map } = setup([FARMHOUSE], 'en');
    const objects = screen.getByRole('region', { name: 'Objects' });
    await userEvent.click(
      within(objects).getByRole('button', { name: 'Celeiro' }),
    );
    clickTile(map, 6, 0);
    expect(onChange).not.toHaveBeenCalled();
    const panel = screen.getByRole('region', { name: 'Details' });
    expect(within(panel).getByText('Blocked ground')).toBeInTheDocument();
    expect(within(panel).getByText('Selection')).toBeInTheDocument();
    expect(within(panel).getByText('Problems')).toBeInTheDocument();
    expect(within(panel).getByText('Summary')).toBeInTheDocument();
  });

  it('should refuse a single place at the 8,000 object limit and say why', async () => {
    // Parked outside the map so they do not touch the tile being placed on.
    const parked = Array.from({ length: MAX_OBJECTS - 1 }, () => ({
      t: 'scarecrow',
      x: -50,
      y: -50,
    }));
    const { onChange, map } = setup([FARMHOUSE, ...parked]);
    await pick('Espantalho');
    clickTile(map, 5, 5);
    expect(onChange).not.toHaveBeenCalled();
    expect(
      within(details()).getByText('Limite de 8.000 objetos atingido'),
    ).toBeInTheDocument();
  });

  it('should paint tilled soil over a rectangle, skipping occupied tiles', async () => {
    const { onChange, map } = setup();
    await pick('Terra arada');
    dragTiles(map, [0, 1], [2, 2]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const objects = lastObjects(onChange);
    expect(objects).toHaveLength(5);
    expect(objects).toEqual(
      expect.arrayContaining([
        { t: 'tilled-soil', x: 2, y: 1 },
        { t: 'tilled-soil', x: 0, y: 2 },
        { t: 'tilled-soil', x: 1, y: 2 },
        { t: 'tilled-soil', x: 2, y: 2 },
      ]),
    );
  });

  describe('paint ghost', () => {
    const ghost = (map: Element, kind: 'ok' | 'bad') =>
      map.querySelector(
        kind === 'ok'
          ? '[class~="fill-green-500/40"]'
          : '[class~="fill-red-500/40"]',
      );
    const startPaint = (
      map: Element,
      from: [number, number],
      to: [number, number],
    ) => {
      const at = (x: number, y: number) => ({
        pointerId: 1,
        button: 0,
        clientX: x * TILE_PX + TILE_PX / 2,
        clientY: y * TILE_PX + TILE_PX / 2,
      });
      fireEvent.pointerDown(map, at(...from));
      fireEvent.pointerMove(map, at(...to));
    };

    it('should be green when the rectangle adds objects', async () => {
      const { map } = setup();
      await pick('Terra arada');
      startPaint(map, [0, 6], [2, 7]);
      expect(ghost(map, 'ok')).not.toBeNull();
      expect(ghost(map, 'bad')).toBeNull();
    });

    it('should be red when the rectangle would add nothing', async () => {
      const { map } = setup();
      await pick('Terra arada');
      startPaint(map, [6, 0], [8, 1]);
      expect(ghost(map, 'bad')).not.toBeNull();
      expect(ghost(map, 'ok')).toBeNull();
    });

    it('should be red when the rectangle would pass the object limit', async () => {
      const parked = Array.from({ length: MAX_OBJECTS - 2 }, () => ({
        t: 'scarecrow',
        x: -50,
        y: -50,
      }));
      const { map } = setup([FARMHOUSE, ...parked]);
      await pick('Terra arada');
      startPaint(map, [0, 6], [1, 6]);
      expect(ghost(map, 'bad')).not.toBeNull();
      expect(ghost(map, 'ok')).toBeNull();
    });
  });

  it('should select with V and move by one tile with the arrow keys', async () => {
    const { onChange, map } = setup();
    await userEvent.keyboard('v');
    clickTile(map, 1, 1);
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastObjects(onChange)).toEqual([{ t: 'farmhouse', x: 1, y: 0 }]);
  });

  it('should keep the farmhouse when the delete tool hits it', async () => {
    const { onChange, map } = setup();
    await userEvent.keyboard('e');
    clickTile(map, 0, 0);
    expect(onChange).not.toHaveBeenCalled();
    expect(
      within(details()).getByText('Esse objeto não pode ser removido'),
    ).toBeInTheDocument();
    expect(map.querySelector('[data-object="farmhouse"]')).not.toBeNull();
  });

  it('should delete a removable object with the delete tool', async () => {
    const { onChange, map } = setup([
      FARMHOUSE,
      { t: 'scarecrow', x: 5, y: 5 },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    clickTile(map, 5, 5);
    expect(lastObjects(onChange)).toEqual([FARMHOUSE]);
  });

  it('should not delete when a second finger starts a pinch', async () => {
    const { onChange, map } = setup([
      FARMHOUSE,
      { t: 'scarecrow', x: 5, y: 5 },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    const touch = (pointerId: number, x: number, y: number) => ({
      pointerId,
      pointerType: 'touch',
      button: 0,
      clientX: x * TILE_PX + TILE_PX / 2,
      clientY: y * TILE_PX + TILE_PX / 2,
    });
    fireEvent.pointerDown(map, touch(1, 5, 5));
    fireEvent.pointerDown(map, touch(2, 8, 7));
    fireEvent.pointerMove(map, touch(2, 9, 7));
    fireEvent.pointerUp(map, touch(2, 9, 7));
    fireEvent.pointerUp(map, touch(1, 5, 5));
    expect(onChange).not.toHaveBeenCalled();
    expect(map.querySelector('[data-object="scarecrow"]')).not.toBeNull();
  });

  it('should delete nothing when the delete rectangle covers no object', async () => {
    const { onChange, map } = setup([
      FARMHOUSE,
      { t: 'scarecrow', x: 5, y: 5 },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    dragTiles(map, [9, 3], [11, 4]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should undo with Ctrl+Z and redo with Ctrl+Shift+Z', async () => {
    const { onChange, map } = setup();
    await pick('Celeiro');
    clickTile(map, 3, 3);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(lastObjects(onChange)).toEqual([FARMHOUSE]);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(lastObjects(onChange)).toEqual([
      FARMHOUSE,
      { t: 'barn', x: 3, y: 3 },
    ]);
  });

  it('should list an object loaded on a blocked tile in the details panel', () => {
    const { onChange, map } = setup([FARMHOUSE, { t: 'barn', x: 6, y: 0 }]);
    const panel = within(details());
    expect(panel.getByText('Terreno bloqueado')).toBeInTheDocument();
    expect(panel.getByText(/Celeiro/)).toBeInTheDocument();
    expect(map.querySelector('[data-issue="error"]')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should drop unknown objects on load, say so and report the cleanup once', () => {
    const { onChange } = setup([FARMHOUSE, { t: 'gone', x: 4, y: 4 }]);
    expect(
      screen.getByText('1 objeto removido porque não existe mais'),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([FARMHOUSE]);
  });

  it('should reset to reloaded objects, dropping and reporting unknown ones', () => {
    const onChange = vi.fn();
    const ref = createRef<FarmEditorHandle>();
    renderWithIntl(
      <FarmEditor
        ref={ref}
        plan={planWith([FARMHOUSE, { t: 'scarecrow', x: 5, y: 5 }])}
        terrain={terrain}
        catalog={catalog}
        onChange={onChange}
      />,
    );
    const map = screen.getByRole('application', { name: 'Mapa da fazenda' });
    act(() =>
      ref.current?.reset([
        FARMHOUSE,
        { t: 'barn', x: 3, y: 3 },
        { t: 'gone', x: 9, y: 4 },
      ]),
    );
    expect(map.querySelector('[data-object="scarecrow"]')).toBeNull();
    expect(map.querySelector('[data-object="barn"]')).not.toBeNull();
    expect(
      screen.getByText('1 objeto removido porque não existe mais'),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      FARMHOUSE,
      { t: 'barn', x: 3, y: 3 },
    ]);
  });

  it('should reset silently when every reloaded object is known', () => {
    const onChange = vi.fn();
    const ref = createRef<FarmEditorHandle>();
    renderWithIntl(
      <FarmEditor
        ref={ref}
        plan={planWith([FARMHOUSE, { t: 'gone', x: 9, y: 4 }])}
        terrain={terrain}
        catalog={catalog}
        onChange={onChange}
      />,
    );
    onChange.mockClear();
    act(() => ref.current?.reset([FARMHOUSE]));
    expect(screen.queryByText(/removido porque/)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should pluralize the dropped objects message', () => {
    setup([FARMHOUSE, { t: 'gone', x: 4, y: 4 }, { t: 'gone', x: 5, y: 4 }]);
    expect(
      screen.getByText('2 objetos removidos porque não existem mais'),
    ).toBeInTheDocument();
  });

  it('should hide fixed objects that cannot be removed from the palette', () => {
    setup();
    const buttons = within(palette()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).not.toContain('Casa da fazenda');
    expect(
      within(palette()).getByRole('button', { name: 'Celeiro' }),
    ).toBeInTheDocument();
  });

  it('should filter the palette by search', async () => {
    setup();
    await userEvent.type(
      within(palette()).getByRole('searchbox', { name: 'Buscar objeto' }),
      'spr',
    );
    const names = within(palette())
      .getAllByRole('button')
      .map((b) => b.textContent);
    // Only the group with matches is left: its header, then its items.
    expect(names).toEqual([
      'Aspersores',
      'Aspersor',
      'Aspersor com irídio',
      'Aspersor de qualidade',
    ]);
  });

  it('should give every icon-only button a pt-BR aria-label and the same title', () => {
    setup();
    for (const name of [
      'Colocar',
      'Selecionar',
      'Apagar',
      'Desfazer',
      'Refazer',
      'Aumentar zoom',
      'Diminuir zoom',
      'Ajustar à tela',
    ]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'title',
        name,
      );
    }
    const iconOnly = screen
      .getAllByRole('button')
      .filter((b) => !b.textContent?.trim());
    expect(iconOnly.length).toBeGreaterThanOrEqual(8);
    for (const button of iconOnly) {
      const label = button.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(button).toHaveAttribute('title', label);
    }
  });
});

describe('FarmEditor coverage layer', () => {
  afterEach(() => localStorage.clear());

  const layer = (map: Element) => map.querySelector('[data-layer="coverage"]');
  const preview = (map: Element) =>
    map.querySelector('[data-layer="range-preview"]');

  it('should draw the coverage as four paths when the toggle is on, however many tiles there are', async () => {
    const soil = Array.from({ length: 24 }, (_, i) => ({
      t: 'tilled-soil',
      x: i % 12,
      y: 6 + Math.floor(i / 12),
    }));
    const { map } = setup([
      FARMHOUSE,
      ...soil,
      { t: 'quality-sprinkler', x: 2, y: 4 },
      { t: 'quality-sprinkler', x: 6, y: 4 },
      { t: 'scarecrow', x: 10, y: 3 },
    ]);
    const toggle = screen.getByRole('button', { name: 'Cobertura' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(layer(map)).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(layer(map)?.querySelectorAll('path')).toHaveLength(4);
    await userEvent.click(toggle);
    expect(layer(map)).toBeNull();
  });

  it('should preview the range of the picked sprinkler when hovering with the layer off', async () => {
    const { map } = setup();
    await pick('Aspersor de qualidade');
    hoverTile(map, 4, 4);
    expect(layer(map)).toBeNull();
    expect(preview(map)?.getAttribute('d')).toBe(
      'M3 3h3v1h-3zM3 4h1v1h-1zM5 4h1v1h-1zM3 5h3v1h-3z',
    );
  });

  it('should move the range preview with a selected sprinkler while it is dragged', async () => {
    const { map } = setup([FARMHOUSE, { t: 'sprinkler', x: 5, y: 4 }]);
    await userEvent.keyboard('v');
    clickTile(map, 5, 4);
    const at = (x: number, y: number) => ({
      pointerId: 1,
      button: 0,
      clientX: x * TILE_PX + TILE_PX / 2,
      clientY: y * TILE_PX + TILE_PX / 2,
    });
    fireEvent.pointerDown(map, at(5, 4));
    fireEvent.pointerMove(map, at(7, 4));
    expect(
      map.querySelector('[data-layer="range-preview"]')?.getAttribute('d'),
    ).toBe('M7 3h1v1h-1zM6 4h1v1h-1zM8 4h1v1h-1zM7 5h1v1h-1z');
  });

  it('should preview the range of a placed scarecrow when it is selected', async () => {
    const { map } = setup([FARMHOUSE, { t: 'scarecrow', x: 5, y: 4 }]);
    await userEvent.keyboard('v');
    clickTile(map, 5, 4);
    expect(preview(map)).not.toBeNull();
  });
});

describe('FarmEditor coverage summary', () => {
  // Soil on (0..5, 6); a quality sprinkler waters 0..2, a sprinkler waters 3; a scarecrow protects all.
  const field = [
    FARMHOUSE,
    ...[0, 1, 2, 3, 4, 5].map((x) => ({ t: 'tilled-soil', x, y: 6 })),
    { t: 'quality-sprinkler', x: 1, y: 5 },
    { t: 'sprinkler', x: 3, y: 5 },
    { t: 'scarecrow', x: 3, y: 3 },
  ];
  const coverageBlock = () =>
    within(details()).getByRole('region', { name: 'Cobertura' });

  it('should show tilled, watered and protected counts when there are tilled tiles', () => {
    setup(field);
    const block = coverageBlock();
    expect(within(block).getByText('Tiles arados: 6')).toBeInTheDocument();
    expect(within(block).getByText('Regados: 4 (66%)')).toBeInTheDocument();
    expect(within(block).getByText('Protegidos: 6 (100%)')).toBeInTheDocument();
    expect(
      within(block).getByRole('button', { name: '2 tiles sem água' }),
    ).toBeInTheDocument();
    expect(within(block).queryByText(/sem proteção/)).toBeNull();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('should turn the coverage layer on when jumping to a dry tile', async () => {
    const { map } = setup(field);
    expect(map.querySelector('[data-layer="coverage"]')).toBeNull();
    await userEvent.click(
      within(coverageBlock()).getByRole('button', { name: '2 tiles sem água' }),
    );
    expect(map.querySelector('[data-layer="coverage"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cobertura' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('should close the details drawer when jumping from it', async () => {
    setup(field);
    await userEvent.click(
      screen.getByRole('button', { name: 'Abrir detalhes' }),
    );
    const drawer = screen.getByRole('dialog');
    await userEvent.click(
      within(drawer).getByRole('button', { name: '2 tiles sem água' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('should use the singular and never round up to 100% when one tile is dry', () => {
    // 11 tilled tiles; two iridium sprinklers water x 0..9, so only x 10 is dry (10/11 = 90.9%).
    const tiles = Array.from({ length: 11 }, (_, x) => ({
      t: 'tilled-soil',
      x,
      y: 6,
    }));
    setup([
      FARMHOUSE,
      ...tiles,
      { t: 'iridium-sprinkler', x: 2, y: 5 },
      { t: 'iridium-sprinkler', x: 7, y: 5 },
      { t: 'scarecrow', x: 5, y: 3 },
    ]);
    const block = coverageBlock();
    expect(
      within(block).getByRole('button', { name: '1 tile sem água' }),
    ).toBeInTheDocument();
    expect(within(block).getByText('Regados: 10 (90%)')).toBeInTheDocument();
  });

  it('should centre the map on the first dry tile when its button is clicked', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 200,
      top: 0,
      left: 0,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const { map } = setup(field);
    await userEvent.click(
      within(coverageBlock()).getByRole('button', { name: '2 tiles sem água' }),
    );
    const [x, y, w, h] = (map.getAttribute('viewBox') ?? '')
      .split(' ')
      .map(Number);
    expect(x + w / 2).toBeCloseTo(4.5);
    expect(y + h / 2).toBeCloseTo(6.5);
  });

  it('should say there are no tilled tiles when the plan has none', () => {
    setup();
    expect(
      within(coverageBlock()).getByText('Nenhum tile arado ainda'),
    ).toBeInTheDocument();
  });
});

describe('FarmEditor map navigation', () => {
  // The map container measures 400x200, so the 12x8 map fits at 1.5625x (25 px per tile, x offset 50).
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 200,
      top: 0,
      left: 0,
      right: 400,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  const viewBox = (map: Element) =>
    (map.getAttribute('viewBox') ?? '').split(' ').map(Number);
  const px = (x: number, y: number) => ({
    pointerId: 1,
    button: 0,
    clientX: x,
    clientY: y,
  });

  it('should pan without changing the zoom when the wheel scrolls without a modifier', () => {
    const { map } = setup();
    const [x, y, w, h] = viewBox(map);
    fireEvent.wheel(map, {
      deltaX: 20,
      deltaY: 40,
      clientX: 200,
      clientY: 100,
    });
    const [x2, y2, w2, h2] = viewBox(map);
    expect([w2, h2]).toEqual([w, h]);
    expect(x2).toBeCloseTo(x + 20 / 25);
    expect(y2).toBeCloseTo(y + 40 / 25);
  });

  it('should pan horizontally when the wheel scrolls with Shift', () => {
    const { map } = setup();
    const [x, y] = viewBox(map);
    fireEvent.wheel(map, { deltaY: 40, shiftKey: true });
    const [x2, y2] = viewBox(map);
    expect(x2).toBeCloseTo(x + 40 / 25);
    expect(y2).toBeCloseTo(y);
  });

  it('should zoom when the wheel scrolls with Ctrl', () => {
    const { map } = setup();
    const [, , w] = viewBox(map);
    fireEvent.wheel(map, {
      deltaY: -100,
      ctrlKey: true,
      clientX: 200,
      clientY: 100,
    });
    expect(viewBox(map)[2]).toBeLessThan(w);
  });

  it('should pan when the select tool drags on empty space', () => {
    const { map } = setup();
    const [x, y] = viewBox(map);
    fireEvent.pointerDown(map, px(300, 150));
    fireEvent.pointerMove(map, px(250, 120));
    fireEvent.pointerUp(map, px(250, 120));
    const [x2, y2] = viewBox(map);
    expect(x2).toBeCloseTo(x + 50 / 25);
    expect(y2).toBeCloseTo(y + 30 / 25);
  });

  it('should clear the selection without panning when the select tool clicks empty space', () => {
    const { map } = setup();
    // The farmhouse covers tiles 0..1, i.e. px 50..100 by 0..50.
    fireEvent.pointerDown(map, px(60, 10));
    fireEvent.pointerUp(map, px(60, 10));
    expect(within(details()).getByText('Casa da fazenda')).toBeInTheDocument();
    const before = viewBox(map);
    fireEvent.pointerDown(map, px(300, 150));
    fireEvent.pointerMove(map, px(302, 151));
    fireEvent.pointerUp(map, px(302, 151));
    expect(viewBox(map)).toEqual(before);
    expect(
      within(details()).getByText('Nenhum objeto selecionado.'),
    ).toBeInTheDocument();
  });

  it('should show how to move and zoom the map in the details panel', () => {
    setup();
    expect(
      within(details()).getByText(
        'Arraste o fundo ou role para mover · Ctrl + roda para zoom',
      ),
    ).toBeInTheDocument();
  });
});

describe('FarmEditor bulk delete', () => {
  // Six stone floors on (2..7, 5) and a sprinkler on (8, 5).
  const field: PlacedObject[] = [
    FARMHOUSE,
    ...[2, 3, 4, 5, 6, 7].map((x) => ({ t: 'stone-floor', x, y: 5 })),
    { t: 'sprinkler', x: 8, y: 5 },
  ];
  const eraser = () =>
    userEvent.click(screen.getByRole('button', { name: 'Apagar' }));
  const at = (x: number, y: number) => ({
    pointerId: 1,
    button: 0,
    clientX: x * TILE_PX + TILE_PX / 2,
    clientY: y * TILE_PX + TILE_PX / 2,
  });

  it('should delete every object in the rectangle when dragging over 6 floors and a sprinkler', async () => {
    const { onChange, map } = setup(field);
    await eraser();
    dragTiles(map, [1, 4], [9, 6]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastObjects(onChange)).toEqual([FARMHOUSE]);
  });

  it('should restore all deleted objects when undoing the rectangle once', async () => {
    const { onChange, map } = setup(field);
    await eraser();
    dragTiles(map, [1, 4], [9, 6]);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(lastObjects(onChange)).toEqual(field);
  });

  it('should keep the farmhouse, delete the rest and say why when the rectangle covers it', async () => {
    const { onChange, map } = setup(field);
    await eraser();
    dragTiles(map, [0, 0], [11, 7]);
    expect(lastObjects(onChange)).toEqual([FARMHOUSE]);
    expect(
      within(details()).getByText('Esse objeto não pode ser removido'),
    ).toBeInTheDocument();
  });

  it('should delete only the object under the pointer when clicking without dragging', async () => {
    const { onChange, map } = setup(field);
    await eraser();
    clickTile(map, 4, 5);
    expect(lastObjects(onChange)).toEqual(
      field.filter((o) => !(o.x === 4 && o.y === 5)),
    );
  });

  it('should outline in red the objects the rectangle would delete while dragging', async () => {
    const { onChange, map } = setup(field);
    await eraser();
    fireEvent.pointerDown(map, at(0, 0));
    fireEvent.pointerMove(map, at(11, 7));
    expect(map.querySelectorAll('[class~="fill-red-500/10"]')).toHaveLength(1);
    // The farmhouse cannot be removed, so only the 7 others are marked.
    expect(map.querySelectorAll('[class~="fill-red-500/20"]')).toHaveLength(7);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should cancel the rectangle when a second finger starts a pinch', async () => {
    const { onChange, map } = setup(field);
    await eraser();
    const touch = (pointerId: number, x: number, y: number) => ({
      ...at(x, y),
      pointerId,
      pointerType: 'touch',
    });
    fireEvent.pointerDown(map, touch(1, 1, 4));
    fireEvent.pointerMove(map, touch(1, 9, 6));
    fireEvent.pointerDown(map, touch(2, 10, 7));
    fireEvent.pointerUp(map, touch(2, 10, 7));
    fireEvent.pointerUp(map, touch(1, 9, 6));
    expect(onChange).not.toHaveBeenCalled();
    expect(map.querySelector('[class~="fill-red-500/10"]')).toBeNull();
  });
});
