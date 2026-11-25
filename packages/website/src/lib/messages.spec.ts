import en from '../messages/en.json';
import ptBR from '../messages/pt-BR.json';
import { loadMessages } from './messages';

type Tree = { [key: string]: string | Tree };

/** Flattens nested messages into `{ 'a.b': 'text' }`. */
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) };
  }, {});

/** Namespaces (objects) too, so an empty namespace missing in one file is caught. */
const namespaces = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [] : [path, ...namespaces(value, path)];
  });

const PLURAL_TYPES = new Set(['plural', 'select', 'selectordinal']);

/**
 * Collects the ICU argument names of a message (`{name}`, `{n, plural, one {...}}` → name, n),
 * including arguments nested in plural/select branches. Apostrophe-quoted text is skipped.
 */
const icuArguments = (message: string): Set<string> => {
  const names = new Set<string>();
  let i = 0;
  const skipSpace = () => {
    while (/\s/.test(message[i] ?? '')) i++;
  };
  const readWord = () => {
    skipSpace();
    const start = i;
    while (i < message.length && !/[\s,{}]/.test(message[i])) i++;
    return message.slice(start, i);
  };
  const consume = (char: string) => {
    skipSpace();
    if (message[i] !== char) {
      throw new Error(
        `Expected "${char}" at ${i} in ${JSON.stringify(message)}`,
      );
    }
    i++;
  };
  // Reads text until the closing brace of the current branch (or the end).
  const parseText = () => {
    while (i < message.length && message[i] !== '}') {
      if (message[i] === "'") {
        if (message[i + 1] === "'") i += 2;
        else if (/[{}#|]/.test(message[i + 1] ?? '')) {
          const end = message.indexOf("'", i + 1);
          i = end === -1 ? message.length : end + 1;
        } else i++;
      } else if (message[i] === '{') {
        i++;
        parseArgument();
      } else i++;
    }
  };
  const parseArgument = () => {
    names.add(readWord());
    skipSpace();
    if (message[i] === '}') {
      i++;
      return;
    }
    consume(',');
    const type = readWord();
    skipSpace();
    if (!PLURAL_TYPES.has(type)) {
      // number/date/time with an optional style: skip to the closing brace.
      const end = message.indexOf('}', i);
      if (end === -1) throw new Error(`Unclosed argument in ${message}`);
      i = end + 1;
      return;
    }
    consume(',');
    for (;;) {
      skipSpace();
      if (message[i] === '}') {
        i++;
        return;
      }
      readWord(); // selector (`one`, `=0`, `offset:1`, ...)
      skipSpace();
      if (message[i] !== '{') continue; // `offset:1` has no branch
      i++;
      parseText();
      consume('}');
    }
  };
  parseText();
  if (i < message.length) {
    throw new Error(`Unbalanced "}" in ${JSON.stringify(message)}`);
  }
  return names;
};

describe('icuArguments', () => {
  it.each([
    ['Página não encontrada', []],
    ['Olá {name}!', ['name']],
    ['{n, plural, one {# dia} other {# dias}}', ['n']],
    [
      '{n, plural, one {{who} plantou} other {{who} plantaram {count}}}',
      ['n', 'who', 'count'],
    ],
    ['{kind, select, crop {Lavoura} other {Outro}}', ['kind']],
    ['{value, number, integer} ouro', ['value']],
    ["Use '{chaves}' literais", []],
  ])('reads %j', (message, expected) => {
    expect([...icuArguments(message)].sort()).toEqual([...expected].sort());
  });
});

describe('message files', () => {
  it('test_messages_have_same_keys', () => {
    expect(Object.keys(flatten(en)).sort()).toEqual(
      Object.keys(flatten(ptBR)).sort(),
    );
    expect(namespaces(en).sort()).toEqual(namespaces(ptBR).sort());
  });

  it('test_messages_have_same_placeholders', () => {
    const english = flatten(en);
    for (const [key, message] of Object.entries(flatten(ptBR))) {
      expect(
        [...icuArguments(english[key] ?? '')].sort(),
        `placeholders of "${key}"`,
      ).toEqual([...icuArguments(message)].sort());
    }
  });

  it('has the top-level namespaces of the spec', () => {
    expect(Object.keys(ptBR).sort()).toEqual(
      [
        'common',
        'nav',
        'theme',
        'language',
        'today',
        'farming',
        'plantings',
        'machines',
        'farmPlanner',
        'seeds',
        'fish',
        'calendar',
        'events',
        'shops',
        'labels',
        'errors',
        'notFound',
      ].sort(),
    );
  });

  it('has the not-found title in both languages', () => {
    expect(ptBR.notFound.title).toBe('Página não encontrada');
    expect(en.notFound.title).toBe('Page not found');
  });
});

describe('loadMessages', () => {
  it('resolves en to the en.json content', async () => {
    await expect(loadMessages('en')).resolves.toEqual(en);
  });
  it('resolves pt-BR to the pt-BR.json content', async () => {
    await expect(loadMessages('pt-BR')).resolves.toEqual(ptBR);
  });
});
