import { screen } from '@testing-library/react';
import { renderWithIntl } from '../renderWithIntl';
import { Toolbar, type ToolbarProps } from './Toolbar';

const props: ToolbarProps = {
  planName: 'Plano 1',
  saveStatus: 'idle',
  tool: 'place',
  onTool: vi.fn(),
  canUndo: true,
  canRedo: true,
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  zoom: 1,
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onFit: vi.fn(),
  showCoverage: false,
  onToggleCoverage: vi.fn(),
  onOpenPalette: vi.fn(),
  onOpenDetails: vi.fn(),
};

const labelsOf = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent);

describe('Toolbar', () => {
  it('should label the tools in Portuguese', () => {
    renderWithIntl(<Toolbar {...props} />);
    expect(labelsOf()).toEqual([
      'Colocar',
      'Selecionar',
      'Apagar',
      'Desfazer',
      'Refazer',
      'Cobertura',
      'Diminuir zoom',
      'Aumentar zoom',
      'Ajustar à tela',
      'Abrir objetos',
      'Abrir detalhes',
    ]);
  });

  it('should label the tools in English, with a matching tooltip', () => {
    renderWithIntl(<Toolbar {...props} />, { locale: 'en' });
    expect(labelsOf()).toEqual([
      'Place',
      'Select',
      'Erase',
      'Undo',
      'Redo',
      'Coverage',
      'Zoom out',
      'Zoom in',
      'Fit to screen',
      'Open objects',
      'Open details',
    ]);
    expect(screen.getByRole('button', { name: 'Place' })).toHaveAttribute(
      'title',
      'Place',
    );
    expect(screen.getByRole('group', { name: 'Tools' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'History' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Panels' })).toBeVisible();
  });
});
