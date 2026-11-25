import { screen } from '@testing-library/react';
import { useLocale, useTranslations } from 'use-intl';
import { renderWithIntl } from './renderWithIntl';
import { renderWithRouter } from './renderWithRouter';

const Title = () => {
  const t = useTranslations('notFound');
  return (
    <p>
      {useLocale()}: {t('title')}
    </p>
  );
};

describe('renderWithIntl', () => {
  it('defaults to pt-BR', () => {
    renderWithIntl(<Title />);
    expect(screen.getByText('pt-BR: Página não encontrada')).toBeTruthy();
  });
  it('accepts en', () => {
    renderWithIntl(<Title />, { locale: 'en' });
    expect(screen.getByText('en: Page not found')).toBeTruthy();
  });
});

describe('renderWithRouter', () => {
  it('defaults to pt-BR', async () => {
    renderWithRouter(<Title />);
    expect(
      await screen.findByText('pt-BR: Página não encontrada'),
    ).toBeTruthy();
  });
  it('accepts en', async () => {
    renderWithRouter(<Title />, { locale: 'en' });
    expect(await screen.findByText('en: Page not found')).toBeTruthy();
  });
  it('infers en from the initial path prefix', async () => {
    renderWithRouter(null, {
      initialPath: '/en/seeds',
      pages: [{ path: '/{-$locale}/seeds', component: Title }],
    });
    expect(await screen.findByText('en: Page not found')).toBeTruthy();
  });
});
