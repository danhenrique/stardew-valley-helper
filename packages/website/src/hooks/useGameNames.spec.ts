import { humanizeId } from '../lib/i18n';
import { pickName } from './useGameNames';

describe('pickName', () => {
  it('should prefer the pt-BR name', () => {
    expect(pickName({ a: { en: 'Apple', ptBr: 'Maçã' } }, 'a')).toBe('Maçã');
  });

  it('should fall back to the English name when pt-BR is missing', () => {
    expect(pickName({ a: { en: 'Apple', ptBr: null } }, 'a')).toBe('Apple');
  });

  it('should humanize the id when the names are not loaded or the id is unknown', () => {
    expect(pickName(undefined, 'blackberry-cobbler')).toBe(
      humanizeId('blackberry-cobbler'),
    );
    expect(pickName({}, 'blackberry-cobbler')).toBe('Blackberry Cobbler');
  });
});
