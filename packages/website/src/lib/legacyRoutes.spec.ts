import { legacyRedirect } from './legacyRoutes';

describe('legacyRedirect', () => {
  it.each([
    ['/producao', {}, '/farming', {}],
    ['/producao', { aba: 'maquinas' }, '/farming', { tab: 'machines' }],
    ['/producao', { aba: 'plantios' }, '/farming', { tab: 'plantings' }],
    ['/fazenda', {}, '/farm', {}],
    ['/fazenda/abc', {}, '/farm/abc', {}],
    ['/sementes', {}, '/seeds', {}],
    ['/peixes', {}, '/fish', {}],
    ['/calendario', { aba: 'eventos' }, '/calendar', { tab: 'events' }],
    ['/calendario', { aba: 'calendario' }, '/calendar', { tab: 'calendar' }],
    ['/lojas', {}, '/shops', {}],
    ['/lojas/blacksmith', {}, '/shops/blacksmith', {}],
    ['/eventos/egg-festival', {}, '/events/egg-festival', {}],
    ['/maquinas', {}, '/farming', { tab: 'machines' }],
    ['/plantios', {}, '/farming', { tab: 'plantings' }],
    ['/eventos', {}, '/calendar', { tab: 'events' }],
  ])('should redirect %s %j to %s %j', (pathname, search, to, expected) => {
    expect(legacyRedirect(pathname, search)).toEqual({ to, search: expected });
  });

  it('should ignore a trailing slash', () => {
    expect(legacyRedirect('/lojas/', {})).toEqual({ to: '/shops', search: {} });
  });

  it('should keep the other search params', () => {
    expect(legacyRedirect('/sementes', { foo: '1' })).toEqual({
      to: '/seeds',
      search: { foo: '1' },
    });
  });

  it('should drop an unknown aba value', () => {
    expect(legacyRedirect('/producao', { aba: 'foo' })).toEqual({
      to: '/farming',
      search: {},
    });
  });

  it.each(['/constructor', '/toString', '/__proto__', '/hasOwnProperty'])(
    'should return null for the inherited key %s',
    (pathname) => {
      expect(legacyRedirect(pathname, {})).toBeNull();
    },
  );

  it('should ignore an aba value that is an inherited key', () => {
    expect(legacyRedirect('/producao', { aba: 'constructor' })).toEqual({
      to: '/farming',
      search: {},
    });
  });

  it.each(['/seeds', '/en/seeds', '/', '/en', '/xx'])(
    'should return null for %s',
    (pathname) => {
      expect(legacyRedirect(pathname, {})).toBeNull();
    },
  );
});
