import { screen } from '@testing-library/react';
import { Footer } from './Footer';
import { renderWithIntl } from './renderWithIntl';

describe('Footer', () => {
  it('should credit ConcernedApe for the images when rendered', () => {
    renderWithIntl(<Footer />);
    expect(
      screen.getByText(
        'Stardew Valley © ConcernedApe. Imagens usadas sem fins comerciais.',
      ),
    ).toBeInTheDocument();
  });

  it('should show the notice in English under the en locale', () => {
    renderWithIntl(<Footer />, { locale: 'en' });
    expect(
      screen.getByText(
        'Stardew Valley © ConcernedApe. Images used for non-commercial purposes.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Fan site, not for profit/)).toBeInTheDocument();
  });
});
