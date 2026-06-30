"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }
    router.push("/admin");
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/invite/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: form.get("code") }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Invalid or expired code");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  if (mode === "choose") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-stone-900">
              Strange<span className="text-amber-600">HQ</span>
            </h1>
            <p className="text-stone-500 text-sm mt-2">Get started by creating or joining a company</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full rounded-lg bg-stone-800 px-6 py-3 text-white font-medium hover:bg-stone-700 transition-colors"
            >
              Create a company
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full rounded-lg border border-stone-300 px-6 py-3 text-stone-700 font-medium hover:bg-stone-50 transition-colors"
            >
              Join with invite code
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <button
          onClick={() => { setMode("choose"); setError(""); }}
          className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1"
        >
          ← Back
        </button>

        {mode === "create" ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <h2 className="text-xl font-bold text-stone-900">Create a company</h2>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
                Company name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Kavos Baras"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-stone-800 px-6 py-3 text-white font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating…" : "Create company"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <h2 className="text-xl font-bold text-stone-900">Join a company</h2>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-stone-700 mb-1">
                Invite code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                placeholder="e.g. ABC12345"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-stone-800 px-6 py-3 text-white font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Joining…" : "Join company"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
