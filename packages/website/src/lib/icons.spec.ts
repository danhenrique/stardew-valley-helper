import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import manifest from './icon-manifest.json';
import { hasIcon, iconUrl, uiIconUrl } from './icons';

const PUBLIC_ICONS = resolve(__dirname, '../../public/icons');

describe('icons', () => {
  it('should build the url from the base url when given an id', () => {
    expect(iconUrl('abigail')).toBe(
      `${import.meta.env.BASE_URL}icons/abigail.png`,
    );
  });

  it('should build the ui url from the base url when given a file name', () => {
    expect(uiIconUrl('festival.gif')).toBe(
      `${import.meta.env.BASE_URL}icons/ui/festival.gif`,
    );
  });

  it('should report an icon when the id is in the manifest', () => {
    expect(hasIcon('abigail')).toBe(true);
  });

  it('should report no icon when the id is not in the manifest', () => {
    expect(hasIcon('not-a-real-id')).toBe(false);
  });

  it('should have a png in public/icons when an id is in the manifest', () => {
    const missing = manifest.filter(
      (id) => !existsSync(resolve(PUBLIC_ICONS, `${id}.png`)),
    );
    expect(missing).toEqual([]);
  });
});
