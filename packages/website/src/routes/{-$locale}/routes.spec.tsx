import { createRouter } from '@tanstack/react-router';
import { routeTree } from '../../routeTree.gen';

const ROUTES = [
  ['farming', '/{-$locale}/farming'],
  ['farm', '/{-$locale}/farm/'],
  ['farm/some-plan', '/{-$locale}/farm/$id'],
  ['seeds', '/{-$locale}/seeds'],
  ['fish', '/{-$locale}/fish'],
  ['calendar', '/{-$locale}/calendar'],
  ['shops', '/{-$locale}/shops/'],
  ['shops/pierre', '/{-$locale}/shops/$id'],
  ['events/festival:egg', '/{-$locale}/events/$id'],
] as const;

describe('English routes in the app route tree', () => {
  const router = createRouter({ routeTree });

  it.each(ROUTES)('should match /%s and /en/%s to %s', (path, routeId) => {
    const plain = router.matchRoutes(`/${path}`);
    const english = router.matchRoutes(`/en/${path}`);
    expect(plain.at(-1)?.routeId).toBe(routeId);
    expect(english.at(-1)?.routeId).toBe(routeId);
    expect(english.at(-1)?.params).toMatchObject({ locale: 'en' });
  });

  it.each(['producao', 'fazenda', 'sementes', 'peixes', 'calendario', 'lojas'])(
    'should not serve the old Portuguese path /%s',
    (path) => {
      const leaf = router.matchRoutes(`/${path}`).at(-1)?.routeId;
      expect(leaf).not.toMatch(/farming|farm|seeds|fish|calendar|shops/);
    },
  );
});
