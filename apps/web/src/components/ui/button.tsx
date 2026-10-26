import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
const variants = cva(
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:from-amber-500 hover:to-amber-600 active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50',
);
export function Button({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button className={cn(variants(), className)} {...props} />;
}
