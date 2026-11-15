import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('should credit ConcernedApe for the images when rendered', () => {
    render(<Footer />);
    expect(
      screen.getByText(
        'Stardew Valley © ConcernedApe. Imagens usadas sem fins comerciais.',
      ),
    ).toBeInTheDocument();
  });
});
