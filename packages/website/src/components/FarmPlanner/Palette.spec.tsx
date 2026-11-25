import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '../renderWithIntl';
import { catalog } from './editorFixtures.spec-helpers';
import { Palette } from './Palette';

const STORAGE_KEY = 'farmPlanner.paletteCollapsed';

const renderPalette = () =>
  renderWithIntl(
    <Palette catalog={catalog} activeId={undefined} onPick={vi.fn()} />,
  );

const header = (name: string) => screen.getByRole('button', { name });
const item = (name: string) => screen.queryByRole('button', { name });
const search = (text: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar objeto' }), {
    target: { value: text },
  });

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Palette groups', () => {
  it('should hide the items of a group when its header is clicked', () => {
    renderPalette();
    expect(header('Aspersores')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Aspersor')).toBeVisible();
    fireEvent.click(header('Aspersores'));
    expect(header('Aspersores')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Aspersor')).toBeNull();
    expect(item('Terra arada')).toBeVisible();
  });

  it('should keep a group collapsed when the palette is mounted again', () => {
    renderPalette();
    fireEvent.click(header('Aspersores'));
    cleanup();
    renderPalette();
    expect(header('Aspersores')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Aspersor')).toBeNull();
  });

  it('should open a collapsed group with matches while searching and restore it after', () => {
    renderPalette();
    fireEvent.click(header('Aspersores'));
    search('irid');
    expect(header('Aspersores')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Aspersor com irídio')).toBeVisible();
    search('');
    expect(header('Aspersores')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Aspersor com irídio')).toBeNull();
  });

  it('should open every group when the stored state is broken', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    renderPalette();
    expect(header('Aspersores')).toHaveAttribute('aria-expanded', 'true');
  });

  it('should point each header at the list it controls', () => {
    renderPalette();
    const id = header('Aspersores').getAttribute('aria-controls') ?? '';
    expect(document.getElementById(id)).toContainElement(item('Aspersor'));
  });
});
