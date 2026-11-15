import { BellIcon } from '@heroicons/react/20/solid';
import { fireEvent, render, screen } from '@testing-library/react';
import { iconUrl } from '../lib/icons';
import { GameIcon, GameIconOr } from './GameIcon';

describe('GameIcon', () => {
  it('should render a decorative pixelated image when the id has an icon', () => {
    const { container } = render(<GameIcon id="abigail" label="Abigail" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', iconUrl('abigail'));
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveClass('size-6', '[image-rendering:pixelated]');
  });

  it('should keep the aspect ratio when the sprite is not square', () => {
    const { container } = render(<GameIcon id="keg" label="Barril" />);
    expect(container.querySelector('img')).toHaveClass('object-contain');
  });

  it('should name the image when it is not decorative', () => {
    render(<GameIcon id="abigail" label="Abigail" decorative={false} />);
    expect(screen.getByRole('img', { name: 'Abigail' })).toBeInTheDocument();
  });

  it.each([
    ['sm', 'size-4'],
    ['lg', 'size-12'],
  ] as const)(
    'should use %s size class %s when given the size',
    (size, cls) => {
      const { container } = render(
        <GameIcon id="abigail" label="Abigail" size={size} />,
      );
      expect(container.querySelector('img')).toHaveClass(cls);
    },
  );

  it('should render the fallback icon when the id has no icon', () => {
    const { container } = render(<GameIcon id="not-a-real-id" label="X" />);
    expect(container.querySelector('img')).toBeNull();
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('size-6');
  });

  it('should render the fallback icon when the image fails to load', () => {
    const { container } = render(<GameIcon id="abigail" label="Abigail" />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('GameIcon after a load error', () => {
  it('should show the new sprite when the id changes after a failed load', () => {
    const { container, rerender } = render(
      <GameIcon id="abigail" label="Abigail" />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    rerender(<GameIcon id="keg" label="Barril" />);
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('keg'),
    );
  });
});

describe('GameIconOr', () => {
  it('should render the game icon when the id has one', () => {
    const { container } = render(
      <GameIconOr id="abigail" label="Abigail" fallback={BellIcon} />,
    );
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      iconUrl('abigail'),
    );
  });

  it('should render the given fallback when the id has no icon', () => {
    const { container } = render(
      <GameIconOr id="not-a-real-id" label="X" size="sm" fallback={BellIcon} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveClass('size-4');
  });

  it('should render the given fallback when the sprite fails to load', () => {
    const Marker = (props: { className?: string }) => (
      <svg data-testid="marker" {...props} />
    );
    const { container } = render(
      <GameIconOr id="abigail" label="Abigail" fallback={Marker} />,
    );
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(screen.getByTestId('marker')).toHaveClass('size-6');
  });
});
