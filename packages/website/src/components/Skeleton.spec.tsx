import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonCalendar,
  SkeletonCard,
  SkeletonList,
} from './Skeleton';

describe('Skeleton', () => {
  it('should announce the loading label to screen readers when rendered', () => {
    render(<Skeleton label="Carregando lojas...">{null}</Skeleton>);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando lojas...')).toHaveClass('sr-only');
  });

  it('should pulse only when the user allows motion', () => {
    render(<Skeleton label="Carregando...">{null}</Skeleton>);
    expect(screen.getByRole('status')).toHaveClass('motion-safe:animate-pulse');
    expect(screen.getByRole('status')).not.toHaveClass('animate-pulse');
  });

  it('should draw one placeholder row per requested row in a list', () => {
    render(<SkeletonList label="Carregando eventos..." rows={3} />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3);
  });

  it('should draw a card with a title bar and its rows', () => {
    render(<SkeletonCard label="Carregando lembretes..." rows={2} />);
    expect(screen.getByTestId('skeleton-title')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(2);
  });

  it('should draw one cell per requested day in a calendar', () => {
    render(<SkeletonCalendar label="Carregando..." days={28} />);
    expect(screen.getAllByTestId('skeleton-day')).toHaveLength(28);
  });

  it('should use bars that also work in the dark theme', () => {
    render(<SkeletonList label="Carregando..." rows={1} />);
    const [bar] = screen.getAllByTestId('skeleton-bar');
    expect(bar).toHaveClass('bg-gray-200', 'dark:bg-white/10');
  });
});
