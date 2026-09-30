import { useEffect } from 'react';

/**
 * Shown by the top-level error boundary. Plain markup only (no app providers),
 * because it renders when the rest of the app has failed. Saved data is never
 * affected — reloading just re-fetches it.
 */
export function CrashScreen({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);

  useEffect(() => {
    console.error('[Food Vibes] App crashed:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <img src="/brand/logo.png" alt="Food Vibes" className="mx-auto mb-6 h-10 w-auto" />
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page hit an unexpected error. Your saved data is safe — reloading will bring everything back.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Reload page
        </button>
        {message && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-muted-foreground">{message}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
