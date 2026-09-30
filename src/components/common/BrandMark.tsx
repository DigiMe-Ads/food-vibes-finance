import { TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Food Vibes Finance logo lockup (original teal badge). `inverted` is for the dark sidebar. */
export function BrandMark({ inverted, compact, className }: { inverted?: boolean; compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <TrendingDown className="h-[18px] w-[18px]" />
      </span>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className={cn('truncate text-[15px] font-bold tracking-tight', inverted ? 'text-white' : 'text-foreground')}>Food Vibes</p>
          <p className={cn('truncate text-[11px] font-semibold uppercase tracking-wider', inverted ? 'text-sidebar-primary' : 'text-accent')}>Finance</p>
        </div>
      )}
    </div>
  );
}
