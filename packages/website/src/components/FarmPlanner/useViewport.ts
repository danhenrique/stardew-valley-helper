import { useCallback, useRef, useState } from 'react';

/** Pixels per tile of the background image at 1x zoom. */
export const TILE_PX = 16;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.25;

/** `x`/`y` are the screen offset (px) of the map origin; `zoom` scales TILE_PX. */
export type View = { zoom: number; x: number; y: number };
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export const clampZoom = (zoom: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Zooms by `factor` keeping the map point under `at` (container px) in place. */
export const zoomAround = (view: View, factor: number, at: Point): View => {
  const zoom = clampZoom(view.zoom * factor);
  const ratio = zoom / view.zoom;
  return {
    zoom,
    x: at.x - (at.x - view.x) * ratio,
    y: at.y - (at.y - view.y) * ratio,
  };
};

/** The whole map visible and centered in the container. */
export const fitView = (map: Size, container: Size): View => {
  const zoom = clampZoom(
    Math.min(
      container.width / (map.width * TILE_PX),
      container.height / (map.height * TILE_PX),
    ),
  );
  return {
    zoom,
    x: (container.width - map.width * TILE_PX * zoom) / 2,
    y: (container.height - map.height * TILE_PX * zoom) / 2,
  };
};

/** Same zoom, with the centre of `tile` at the centre of the container. */
export const centerOn = (view: View, tile: Point, container: Size): View => {
  const scale = TILE_PX * view.zoom;
  return {
    zoom: view.zoom,
    x: container.width / 2 - (tile.x + 0.5) * scale,
    y: container.height / 2 - (tile.y + 0.5) * scale,
  };
};

/**
 * Keeps at least a quarter of the map (per axis, capped at the container) inside the container,
 * so the map can never be panned or zoomed out of sight. Unchanged while the container is unmeasured.
 */
export const clampView = (view: View, map: Size, container: Size): View => {
  if (container.width <= 0 || container.height <= 0) return view;
  const scale = TILE_PX * view.zoom;
  const axis = (offset: number, mapPx: number, containerPx: number) => {
    const keep = Math.min(mapPx / 4, containerPx);
    return Math.min(containerPx - keep, Math.max(keep - mapPx, offset));
  };
  const x = axis(view.x, map.width * scale, container.width);
  const y = axis(view.y, map.height * scale, container.height);
  return x === view.x && y === view.y ? view : { ...view, x, y };
};

/** Tile under a container pixel. */
export const screenToTile = (point: Point, view: View): Point => {
  const scale = TILE_PX * view.zoom;
  return {
    x: Math.floor((point.x - view.x) / scale),
    y: Math.floor((point.y - view.y) / scale),
  };
};

/** SVG viewBox (in tiles) of the visible area; the whole map while the container is unmeasured. */
export const viewBoxOf = (view: View, container: Size, map: Size): string => {
  if (container.width <= 0 || container.height <= 0) {
    return `0 0 ${map.width} ${map.height}`;
  }
  const scale = TILE_PX * view.zoom;
  return [
    -view.x / scale,
    -view.y / scale,
    container.width / scale,
    container.height / scale,
  ].join(' ');
};

const IDENTITY: View = { zoom: 1, x: 0, y: 0 };

/** Zoom, pan and fit state of the map; `setContainer` feeds the measured container size. */
export const useViewport = (map: Size) => {
  const [view, setView] = useState<View>(IDENTITY);
  const [container, setContainerState] = useState<Size>({
    width: 0,
    height: 0,
  });
  const fitted = useRef(false);

  const measured = container.width > 0 && container.height > 0;
  const center = { x: container.width / 2, y: container.height / 2 };

  const setContainer = useCallback(
    (size: Size) => {
      setContainerState(size);
      if (!fitted.current && size.width > 0 && size.height > 0) {
        fitted.current = true;
        setView(fitView(map, size));
      }
    },
    [map],
  );

  const fit = () => {
    if (measured) setView(fitView(map, container));
  };
  const clamped = (next: View) => clampView(next, map, container);
  const zoomBy = (factor: number, at: Point = center) =>
    setView((v) => clamped(zoomAround(v, factor, at)));
  const panBy = (dx: number, dy: number) =>
    setView((v) => clamped({ ...v, x: v.x + dx, y: v.y + dy }));

  return {
    view,
    container,
    viewBox: viewBoxOf(view, container, map),
    setContainer,
    fit,
    zoomBy,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(1 / ZOOM_STEP),
    panBy,
    centerOn: (tile: Point) =>
      setView((v) => clamped(centerOn(v, tile, container))),
  };
};

export type Viewport = ReturnType<typeof useViewport>;
