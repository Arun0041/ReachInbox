interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps): JSX.Element {
  const sizes = {
    sm: 'w-3.5 h-3.5 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-8 h-8 border-3',
  };
  return (
    <span
      className={`inline-block border-gray-200 border-t-[#10B981] rounded-full animate-spin ${sizes[size]} ${className ?? ''}`}
      role="status"
      aria-label="Loading"
    />
  );
}