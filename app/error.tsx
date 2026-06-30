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
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-stone-500 text-sm">{error.message ?? "An unexpected error occurred."}</p>
        {error.digest && (
          <p className="text-stone-300 text-xs font-mono">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="text-sm text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
