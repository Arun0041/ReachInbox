interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps): JSX.Element {
  return <span className={`spinner spinner--${size} ${className ?? ''}`} role="status" aria-label="Loading" />;
}