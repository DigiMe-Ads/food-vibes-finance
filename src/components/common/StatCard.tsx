import type { ElementType, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'accent' | 'success' | 'destructive' | 'warning' | 'neutral';

const TONES: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  neutral: 'bg-muted text-muted-foreground',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ElementType;
  tone?: Tone;
  /** Class for the value text (e.g. a status colour) */
  valueClassName?: string;
  footer?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, tone = 'primary', valueClassName, footer, loading, className }: StatCardProps) {
  return (
    <Card className={cn('p-5 transition-shadow hover:shadow-hover', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-36" />
      ) : (
        <p className={cn('mt-2 text-2xl font-bold tracking-tight text-foreground amount-text', valueClassName)}>{value}</p>
      )}
      {footer && <div className="mt-3 text-xs text-muted-foreground">{footer}</div>}
    </Card>
  );
}
