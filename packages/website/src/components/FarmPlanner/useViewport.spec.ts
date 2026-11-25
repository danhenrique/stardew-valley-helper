import { act, renderHook } from '@testing-library/react';
import {
  centerOn,
  clampView,
  clampZoom,
  fitView,
  MAX_ZOOM,
  MIN_ZOOM,
  screenToTile,
  TILE_PX,
  useViewport,
  viewBoxOf,
  zoomAround,
} from './useViewport';

const MAP = { width: 80, height: 65 };

describe('viewport math', () => {
  it('should clamp zoom between 0.25x and 8x', () => {
    expect(MIN_ZOOM).toBe(0.25);
    expect(MAX_ZOOM).toBe(8);
    expect(clampZoom(100)).toBe(8);
    expect(clampZoom(0.01)).toBe(0.25);
    expect(clampZoom(2)).toBe(2);
  });

  it('should keep zoomAround within the limits and the point under the cursor fixed', () => {
    const view = { zoom: 1, x: 0, y: 0 };
    expect(zoomAround(view, 1000, { x: 0, y: 0 }).zoom).toBe(8);
    expect(zoomAround(view, 0.0001, { x: 0, y: 0 }).zoom).toBe(0.25);
    const zoomed = zoomAround(view, 2, { x: 160, y: 80 });
    expect(screenToTile({ x: 160, y: 80 }, zoomed)).toEqual(
      screenToTile({ x: 160, y: 80 }, view),
    );
  });

  it('should center the map when fitting', () => {
    const view = fitView(MAP, { width: 1280, height: 520 });
    expect(view.zoom).toBe(0.5);
    const shown = MAP.width * TILE_PX * view.zoom;
    expect(view.x).toBe((1280 - shown) / 2);
    expect(view.y).toBe(0);
  });

  it('should clamp the fit zoom', () => {
    expect(
      fitView({ width: 2, height: 2 }, { width: 4000, height: 4000 }).zoom,
    ).toBe(8);
  });

  it('should map screen pixels to tiles', () => {
    expect(screenToTile({ x: 33, y: 17 }, { zoom: 1, x: 0, y: 0 })).toEqual({
      x: 2,
      y: 1,
    });
    expect(screenToTile({ x: 100, y: 10 }, { zoom: 2, x: 36, y: -54 })).toEqual(
      { x: 2, y: 2 },
    );
  });

  it('should describe the visible area as a viewBox in tiles', () => {
    expect(
      viewBoxOf({ zoom: 1, x: 0, y: 0 }, { width: 0, height: 0 }, MAP),
    ).toBe('0 0 80 65');
    expect(
      viewBoxOf({ zoom: 2, x: -32, y: 0 }, { width: 320, height: 160 }, MAP),
    ).toBe('1 0 10 5');
  });
});

describe('useViewport', () => {
  it('should keep zoom in range through repeated zoom steps', () => {
    const { result } = renderHook(() => useViewport(MAP));
    act(() => {
      for (let i = 0; i < 40; i++) result.current.zoomIn();
    });
    expect(result.current.view.zoom).toBe(8);
    act(() => {
      for (let i = 0; i < 40; i++) result.current.zoomOut();
    });
    expect(result.current.view.zoom).toBe(0.25);
  });

  it('should center the map on fit once the container is measured', () => {
    const { result } = renderHook(() => useViewport(MAP));
    act(() => result.current.setContainer({ width: 1280, height: 520 }));
    act(() => result.current.zoomIn());
    act(() => result.current.fit());
    expect(result.current.view).toEqual(
      fitView(MAP, { width: 1280, height: 520 }),
    );
  });

  it('should pan by screen pixels', () => {
    const { result } = renderHook(() => useViewport(MAP));
    act(() => result.current.panBy(10, -5));
    expect(result.current.view).toEqual({ zoom: 1, x: 10, y: -5 });
  });
});

describe('centerOn', () => {
  it('should put the tile at the container centre when centring, keeping the zoom', () => {
    const view = centerOn(
      { zoom: 2, x: 0, y: 0 },
      { x: 10, y: 5 },
      { width: 400, height: 200 },
    );
    expect(view.zoom).toBe(2);
    expect(screenToTile({ x: 200, y: 100 }, view)).toEqual({ x: 10, y: 5 });
  });
});

describe('clampView', () => {
  const container = { width: 400, height: 200 };
  // 80x65 tiles at 1x: 1280 x 1040 px, so a quarter is 320 x 260 px (capped at the container).

  it('should keep a quarter of the map inside the container when the view is pushed far off', () => {
    const map = { width: 80, height: 65 };
    expect(clampView({ zoom: 1, x: 5000, y: 5000 }, map, container)).toEqual({
      zoom: 1,
      x: 400 - 320,
      y: 0,
    });
    expect(clampView({ zoom: 1, x: -5000, y: -5000 }, map, container)).toEqual({
      zoom: 1,
      x: 320 - 1280,
      y: 200 - 1040,
    });
  });

  it('should leave an in-bounds view unchanged', () => {
    const view = { zoom: 1, x: -100, y: -50 };
    expect(clampView(view, { width: 80, height: 65 }, container)).toBe(view);
  });

  it('should leave the view unchanged while the container is unmeasured', () => {
    const view = { zoom: 1, x: 9000, y: 9000 };
    expect(
      clampView(view, { width: 80, height: 65 }, { width: 0, height: 0 }),
    ).toBe(view);
  });
});
