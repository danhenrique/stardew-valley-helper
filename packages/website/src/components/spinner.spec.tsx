import { render, screen } from '@testing-library/react';
import { expectLoading } from './expectLoading';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('should show a page skeleton while the app starts', () => {
    render(<Spinner />);
    expectLoading(screen.getByText('Carregando...'));
  });
});
