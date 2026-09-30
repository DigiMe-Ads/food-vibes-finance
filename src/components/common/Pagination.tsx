import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number; // zero-based
  totalPages: number;
  totalCount: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalCount, onChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page + 1}</span> of {totalPages} · {totalCount} records
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Previous</span>
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)} className="gap-1">
          <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
