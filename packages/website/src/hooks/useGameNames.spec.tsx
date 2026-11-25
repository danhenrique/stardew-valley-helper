import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntlTestProvider } from '../components/renderWithIntl';
import { humanizeId } from '../lib/i18n';
import type { Locale } from '../lib/locale';
import { pickName, useGameNames } from './useGameNames';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { melon: { en: 'Melon Seeds', ptBr: 'Sementes de Melão' } },
  }),
}));
vi.mock('./useStardewValleyApi', () => ({
  useStardewValleyApi: () => ({
    listGameNames: { queryOptions: () => ({}) },
  }),
}));

describe('pickName', () => {
  it('should prefer the pt-BR name in pt-BR', () => {
    expect(pickName({ a: { en: 'Apple', ptBr: 'Maçã' } }, 'a', 'pt-BR')).toBe(
      'Maçã',
    );
  });

  it('should use the English name in en', () => {
    expect(pickName({ a: { en: 'Apple', ptBr: 'Maçã' } }, 'a', 'en')).toBe(
      'Apple',
    );
  });

  it('should fall back to the English name when pt-BR is missing or empty', () => {
    expect(pickName({ a: { en: 'Apple', ptBr: null } }, 'a', 'pt-BR')).toBe(
      'Apple',
    );
    expect(pickName({ a: { en: 'Apple', ptBr: '' } }, 'a', 'pt-BR')).toBe(
      'Apple',
    );
  });

  it('should humanize the id when the names are not loaded or the id is unknown', () => {
    expect(pickName(undefined, 'blackberry-cobbler', 'en')).toBe(
      humanizeId('blackberry-cobbler'),
    );
    expect(pickName({}, 'blackberry-cobbler', 'pt-BR')).toBe(
      'Blackberry Cobbler',
    );
  });
});

describe('useGameNames', () => {
  const nameIn = (locale: Locale) =>
    renderHook(() => useGameNames().nameOf('melon'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <IntlTestProvider locale={locale}>{children}</IntlTestProvider>
      ),
    }).result.current;

  it('should return the name in the rendered locale', () => {
    expect(nameIn('en')).toBe('Melon Seeds');
    expect(nameIn('pt-BR')).toBe('Sementes de Melão');
  });
});
