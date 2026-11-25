import { canMove, checkPlacement, type RulesContext } from './rules';
import { type Catalog, MAX_OBJECTS, type PlacedObject } from './types';

export type EditorState = {
  objects: PlacedObject[];
  past: PlacedObject[][];
  future: PlacedObject[][];
  selection: ReadonlySet<number>;
  dirty: boolean;
};

export type EditorAction =
  | { type: 'place'; object: PlacedObject }
  | { type: 'paint'; objects: PlacedObject[] }
  | { type: 'move'; indexes: number[]; dx: number; dy: number }
  | { type: 'delete'; indexes: number[] }
  | { type: 'select'; indexes: number[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved' }
  | { type: 'reset'; objects: PlacedObject[] };

export const HISTORY_LIMIT = 100;

/** The rules context is applied against the state's own objects. */
export type EditorContext = Omit<RulesContext, 'objects' | 'ignore'> &
  Partial<Pick<RulesContext, 'objects'>>;

const commit = (state: EditorState, objects: PlacedObject[]): EditorState => ({
  objects,
  past: [...state.past, state.objects].slice(-HISTORY_LIMIT),
  future: [],
  selection: new Set(),
  dirty: true,
});

export const editorReducer = (
  state: EditorState,
  action: EditorAction,
  ctx: EditorContext,
): EditorState => {
  const rules: RulesContext = { ...ctx, objects: state.objects };
  switch (action.type) {
    case 'place': {
      if (state.objects.length >= MAX_OBJECTS) return state;
      const issues = checkPlacement(action.object, rules);
      if (issues.some((i) => i.level === 'error')) return state;
      return commit(state, [...state.objects, action.object]);
    }
    case 'paint':
      if (action.objects.length === 0) return state;
      if (state.objects.length + action.objects.length > MAX_OBJECTS)
        return state;
      return commit(state, [...state.objects, ...action.objects]);
    case 'move': {
      if (action.indexes.length === 0) return state;
      if (!canMove(action.indexes, action.dx, action.dy, rules)) return state;
      const moving = new Set(action.indexes);
      const objects = state.objects.map((o, i) =>
        moving.has(i) ? { ...o, x: o.x + action.dx, y: o.y + action.dy } : o,
      );
      return { ...commit(state, objects), selection: moving };
    }
    case 'delete': {
      const doomed = new Set(
        action.indexes.filter((i) => {
          const o = state.objects[i];
          return o && ctx.catalog.get(o.t)?.removable !== false;
        }),
      );
      if (doomed.size === 0) return state;
      return commit(
        state,
        state.objects.filter((_, i) => !doomed.has(i)),
      );
    }
    case 'select':
      return { ...state, selection: new Set(action.indexes) };
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        objects: previous,
        past: state.past.slice(0, -1),
        future: [state.objects, ...state.future],
        selection: new Set(),
        dirty: true,
      };
    }
    case 'redo': {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return {
        objects: next,
        past: [...state.past, state.objects].slice(-HISTORY_LIMIT),
        future: rest,
        selection: new Set(),
        dirty: true,
      };
    }
    case 'saved':
      return { ...state, dirty: false };
    case 'reset':
      return {
        objects: action.objects,
        past: [],
        future: [],
        selection: new Set(),
        dirty: false,
      };
  }
};

export const loadPlan = (
  objects: PlacedObject[],
  catalog: Catalog,
): { objects: PlacedObject[]; dropped: number } => {
  const kept = objects.filter((o) => catalog.has(o.t));
  return { objects: kept, dropped: objects.length - kept.length };
};
