import type { ReactNode } from 'react';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const VARIANT_DEFAULT: Record<BadgeVariant, string> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

export function Badge({ variant = 'neutral', children }: BadgeProps): JSX.Element {
  return <span className={`badge badge--${VARIANT_DEFAULT[variant]}`}>{children}</span>;
}