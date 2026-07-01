import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="font-display font-extrabold text-7xl text-stone-400">404</p>
        <h1 className="font-display font-bold text-xl uppercase tracking-wide">Page not found</h1>
        <p className="text-stone-500 text-sm">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/dashboard" className="inline-block text-sm text-black underline underline-offset-2">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
