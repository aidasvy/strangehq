"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <h1 className="font-display font-bold text-xl uppercase tracking-wide">Something went wrong</h1>
        <p className="text-stone-500 text-sm">{error.message ?? "An unexpected error occurred."}</p>
        {error.digest && (
          <p className="text-stone-400 text-xs font-mono">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="text-sm text-black underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
