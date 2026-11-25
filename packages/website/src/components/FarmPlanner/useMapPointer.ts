import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { objectsInBox } from '../../lib/farmPlanner/rules';
import type { Catalog, PlacedObject } from '../../lib/farmPlanner/types';
import type { FarmMapProps } from './FarmMap';
import { boxOf, overlaps, rectOf } from './MapLayers';
import { type Point, screenToTile } from './useViewport';

export type Drag =
  /**
   * `origin` is set when the select tool pressed empty space: it only pans once the pointer moves
   * past CLICK_SLOP, and a release before that is a click that clears the selection.
   */
  | { kind: 'pan'; last: Point; origin?: Point; moved?: boolean }
  | { kind: 'place' }
  | { kind: 'paint'; from: Point; to: Point }
  | { kind: 'move'; indexes: number[]; from: Point; to: Point }
  | { kind: 'area'; from: Point; to: Point }
  /**
   * Delete rectangle: on release everything inside goes in one action; a one-tile rectangle (a
   * click) deletes only the top object there. Deleting on release lets a second finger cancel it.
   */
  | { kind: 'delete'; from: Point; to: Point };

/**
 * What a delete rectangle removes: every object inside it, or only the top one (the last drawn)
 * when the rectangle is a single tile, i.e. a click.
 */
export const deletedBy = (
  objects: PlacedObject[],
  catalog: Catalog,
  from: Point,
  to: Point,
): number[] => {
  const inside = objectsInBox(objects, catalog, rectOf(from, to));
  return from.x === to.x && from.y === to.y ? inside.slice(-1) : inside;
};

/** Pointer travel (px) below which a press on empty space is a click, not a pan. */
const CLICK_SLOP = 4;

/** Pixels per wheel `deltaMode` unit: pixels, lines, pages (the container height). */
const wheelUnit = (e: WheelEvent, height: number) =>
  e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1;

/**
 * Pointer gestures on the map: tools, pan (dragging empty space with the select tool, Space or the
 * middle button), pinch, wheel pan and Ctrl/Cmd + wheel zoom.
 */
export const useMapPointer = (
  props: FarmMapProps,
  svgRef: RefObject<SVGSVGElement | null>,
) => {
  const { catalog, objects, selection, tool, active, viewport } = props;
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const tileAt = (e: { clientX: number; clientY: number }) =>
    screenToTile(local(e), viewportRef.current.view);

  // The wheel needs a non-passive listener to stop the page from scrolling.
  // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as wheel + ctrlKey) zooms; otherwise it pans.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const unit = wheelUnit(
        e,
        r.height || viewportRef.current.container.height,
      );
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (e.ctrlKey || e.metaKey) {
        viewportRef.current.zoomBy(Math.exp(-dy * 0.0015), {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
        });
      } else if (e.shiftKey && dx === 0) {
        // An ordinary mouse wheel only has deltaY: Shift turns it sideways.
        viewportRef.current.panBy(-dy, 0);
      } else {
        viewportRef.current.panBy(-dx, -dy);
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const hit = (tile: Point): number => {
    for (let i = objects.length - 1; i >= 0; i--) {
      const def = catalog.get(objects[i].t);
      if (def && overlaps(boxOf(def, objects[i]), { ...tile, w: 1, h: 1 })) {
        return i;
      }
    }
    return -1;
  };

  const pinchState = () => {
    const [a, b] = [...touches.current.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer may already be gone; capture is only a convenience.
    }
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, local(e));
      if (touches.current.size === 2) {
        pinch.current = pinchState();
        setDrag(null);
        return;
      }
    }
    if (e.button === 1 || (e.button === 0 && props.spaceHeld)) {
      e.preventDefault();
      setDrag({ kind: 'pan', last: local(e) });
      return;
    }
    if (e.button !== 0) return;
    const tile = tileAt(e);
    if (tool === 'place') {
      if (!active) return;
      setDrag(
        active.paint
          ? { kind: 'paint', from: tile, to: tile }
          : { kind: 'place' },
      );
    } else if (tool === 'select') {
      const index = e.shiftKey ? -1 : hit(tile);
      if (index >= 0) {
        const indexes = selection.has(index) ? [...selection] : [index];
        if (!selection.has(index)) props.onSelect(indexes);
        setDrag({ kind: 'move', indexes, from: tile, to: tile });
      } else if (e.shiftKey) {
        setDrag({ kind: 'area', from: tile, to: tile });
      } else {
        const p = local(e);
        setDrag({ kind: 'pan', last: p, origin: p });
      }
    } else {
      setDrag({ kind: 'delete', from: tile, to: tile });
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, local(e));
      if (pinch.current && touches.current.size === 2) {
        const next = pinchState();
        viewport.zoomBy(next.dist / pinch.current.dist, next.mid);
        viewport.panBy(
          next.mid.x - pinch.current.mid.x,
          next.mid.y - pinch.current.mid.y,
        );
        pinch.current = next;
        return;
      }
    }
    const current = dragRef.current;
    if (current?.kind === 'pan') {
      const p = local(e);
      const { origin } = current;
      if (
        origin &&
        !current.moved &&
        Math.hypot(p.x - origin.x, p.y - origin.y) < CLICK_SLOP
      ) {
        return;
      }
      viewport.panBy(p.x - current.last.x, p.y - current.last.y);
      setDrag({ ...current, last: p, moved: true });
      return;
    }
    const tile = tileAt(e);
    if (hover?.x !== tile.x || hover?.y !== tile.y) setHover(tile);
    if (current && 'to' in current) {
      if (current.to.x !== tile.x || current.to.y !== tile.y) {
        setDrag({ ...current, to: tile });
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    const current = dragRef.current;
    setDrag(null);
    if (!current) return;
    if (current.kind === 'pan') {
      // A press on empty space that never moved is a click: clear the selection.
      if (current.origin && !current.moved) props.onSelect([]);
      return;
    }
    const tile = tileAt(e);
    if (current.kind === 'place') props.onPlace(tile);
    else if (current.kind === 'paint') props.onPaint(current.from, tile);
    else if (current.kind === 'move') {
      const dx = tile.x - current.from.x;
      const dy = tile.y - current.from.y;
      if (dx || dy) props.onMove(current.indexes, dx, dy);
    } else if (current.kind === 'delete') {
      const indexes = deletedBy(objects, catalog, current.from, tile);
      if (indexes.length) props.onDelete(indexes);
    } else if (current.kind === 'area') {
      const area = rectOf(current.from, tile);
      props.onSelect(
        objects.flatMap((o, i) =>
          overlaps(boxOf(catalog.get(o.t), o), area) ? [i] : [],
        ),
      );
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<SVGSVGElement>) => {
    touches.current.delete(e.pointerId);
    pinch.current = null;
    setDrag(null);
  };

  return {
    drag,
    hover,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave: () => setHover(null),
    },
  };
};
