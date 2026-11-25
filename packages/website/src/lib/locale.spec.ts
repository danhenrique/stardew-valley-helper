import {
  DEFAULT_LOCALE,
  detectLocale,
  LOCALES,
  localeFromPathname,
  localeRedirect,
  localeToSegment,
  localizedText,
  parseLocaleParam,
  readSavedLocale,
  resetMemoryLocale,
  saveLocale,
} from './locale';

describe('LOCALES', () => {
  it('lists the BCP 47 codes with pt-BR as default', () => {
    expect(LOCALES).toEqual(['pt-BR', 'en']);
    expect(DEFAULT_LOCALE).toBe('pt-BR');
  });
});

describe('parseLocaleParam', () => {
  it('maps the missing segment to pt-BR', () => {
    expect(parseLocaleParam(undefined)).toBe('pt-BR');
  });
  it('accepts en', () => {
    expect(parseLocaleParam('en')).toBe('en');
  });
  it.each(['pt', 'pt-BR', 'xx', ''])('rejects %j', (value) => {
    expect(parseLocaleParam(value)).toBeNull();
  });
});

describe('localeToSegment', () => {
  it('has no segment for pt-BR', () => {
    expect(localeToSegment('pt-BR')).toBeUndefined();
  });
  it('uses en for en', () => {
    expect(localeToSegment('en')).toBe('en');
  });
});

describe('localeFromPathname', () => {
  it.each([
    ['/', 'pt-BR'],
    ['/seeds', 'pt-BR'],
    ['/xx/seeds', 'pt-BR'],
    ['/english', 'pt-BR'],
    ['/en', 'en'],
    ['/en/', 'en'],
    ['/en/xx-unknown', 'en'],
  ])('reads %j as %j', (pathname, locale) => {
    expect(localeFromPathname(pathname)).toBe(locale);
  });
});

describe('localizedText', () => {
  it('reads ptBr for pt-BR and en for en', () => {
    const name = { en: 'Parsnip', ptBr: 'Chirívia' };
    expect(localizedText(name, 'pt-BR')).toBe('Chirívia');
    expect(localizedText(name, 'en')).toBe('Parsnip');
  });
  it('falls back to English when pt-BR is null or empty', () => {
    expect(localizedText({ en: 'Flower Seeds', ptBr: null }, 'pt-BR')).toBe(
      'Flower Seeds',
    );
    expect(localizedText({ en: 'X', ptBr: '' }, 'pt-BR')).toBe('X');
  });
  it('is undefined when there is no text', () => {
    expect(localizedText(null, 'en')).toBeUndefined();
    expect(localizedText(undefined, 'pt-BR')).toBeUndefined();
    expect(localizedText({ en: '', ptBr: null }, 'en')).toBeUndefined();
  });
});

describe('detectLocale', () => {
  it.each([
    [null, ['pt-BR'], 'pt-BR'],
    [null, ['pt-PT', 'en'], 'pt-BR'],
    [null, ['en-US'], 'en'],
    [null, ['de'], 'en'],
    [null, [], 'pt-BR'],
    ['pt-BR', ['en-US'], 'pt-BR'],
    ['en', ['pt-BR'], 'en'],
    [null, ['en-US', 'pt-BR'], 'en'],
    [null, ['de', 'pt-BR'], 'pt-BR'],
  ] as const)('detects %s with %j as %s', (saved, languages, expected) => {
    expect(detectLocale(saved, languages)).toBe(expected);
  });
});

describe('localeRedirect', () => {
  it('prefixes an unprefixed path and keeps the search', () => {
    expect(localeRedirect('/shops/blacksmith', { foo: '1' }, 'en')).toEqual({
      to: '/en/shops/blacksmith',
      search: { foo: '1' },
    });
  });

  it('redirects the root to the bare prefix', () => {
    expect(localeRedirect('/', {}, 'en')).toEqual({ to: '/en', search: {} });
  });

  it('does not redirect an already prefixed path', () => {
    expect(localeRedirect('/en/seeds', {}, 'en')).toBeNull();
  });

  it('does not redirect for the default locale', () => {
    expect(localeRedirect('/seeds', {}, 'pt-BR')).toBeNull();
  });
});

describe('saved locale storage', () => {
  afterEach(resetMemoryLocale);

  it('keeps the choice in memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    saveLocale('pt-BR');
    expect(readSavedLocale()).toBe('pt-BR');
  });

  it('prefers the in-memory choice over a stale stored value when the write failed', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('en');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    saveLocale('pt-BR');
    expect(readSavedLocale()).toBe('pt-BR');
  });

  it('returns null when reading storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readSavedLocale()).toBeNull();
  });

  it('does not throw when writing storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => saveLocale('en')).not.toThrow();
  });

  it('round-trips a saved locale and ignores unknown values', () => {
    saveLocale('en');
    expect(readSavedLocale()).toBe('en');
    localStorage.setItem('stardew.locale', 'xx');
    expect(readSavedLocale()).toBeNull();
    localStorage.clear();
  });
});
