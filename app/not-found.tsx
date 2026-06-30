import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-5xl font-bold text-stone-200">404</p>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-stone-500 text-sm">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/dashboard" className="inline-block text-sm text-blue-600 hover:underline">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
