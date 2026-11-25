import { render, screen } from '@testing-library/react';
import { expectLoading } from './expectLoading';
import { Spinner } from './spinner';

describe('Spinner', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('should show a page skeleton while the app starts', () => {
    render(<Spinner />);
    expectLoading(screen.getByText('Carregando...'));
  });

  it('should show the loading text in English under /en', () => {
    window.history.pushState({}, '', '/en/farming');
    render(<Spinner />);
    expectLoading(screen.getByText('Loading...'));
  });
});
