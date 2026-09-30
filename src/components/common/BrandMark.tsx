import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { logo: string; tagline: string; gap: string }> = {
  sm: { logo: 'h-7', tagline: 'text-[8px]', gap: 'mt-1' },
  md: { logo: 'h-9', tagline: 'text-[9.5px]', gap: 'mt-1.5' },
  lg: { logo: 'h-16', tagline: 'text-[13px]', gap: 'mt-3' },
};

/**
 * Food Vibes wordmark (from the official logo) with "Finance" set underneath in the
 * same spaced style as the logo's "Restaurant & Bar" line. The gold artwork reads on
 * both the ivory pages and the espresso sidebar.
 */
export function BrandMark({ size = 'md', compact, className }: { size?: Size; compact?: boolean; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      <img src="/brand/wordmark.png" alt="Food Vibes" className={cn('w-auto select-none', s.logo)} draggable={false} />
      {!compact && (
        // Negative right margin cancels the trailing letter-space so the word stays centred
        <span className={cn('brand-tagline -mr-[0.42em] leading-none text-brand', s.tagline, s.gap)}>Finance</span>
      )}
    </div>
  );
}
