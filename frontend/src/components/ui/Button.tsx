import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className,
  ...rest
}: ButtonProps): JSX.Element {
  const base = "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-[#10B981] text-white hover:bg-[#059669] focus:ring-[#10B981] px-4 py-2 text-sm",
    secondary: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 focus:ring-gray-200 px-4 py-2 text-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 px-4 py-2 text-sm",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-200 px-3 py-1.5 text-sm",
  };

  const classes = [base, variants[variant], fullWidth ? 'w-full' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}