"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "choose" | "create" | "join" | "profile";

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("/dashboard");

  // Profile step state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  async function enterProfileStep(dest: string) {
    setDestination(dest);
    const res = await fetch("/api/profile");
    if (res.ok) {
      const data = await res.json();
      setProfileName(data.name ?? "");
      setProfilePhone(data.phone ?? "");
    }
    setMode("profile");
  }

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
    setLoading(false);
    await enterProfileStep("/admin");
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
    setLoading(false);
    await enterProfileStep("/dashboard");
  }

  async function handleProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: profileName, phone: profilePhone }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save profile");
      setLoading(false);
      return;
    }
    router.push(destination);
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

  if (mode === "profile") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-6">
          <div>
            <p className="text-xs text-stone-400 mb-1">Step 2 of 2</p>
            <h2 className="text-xl font-bold text-stone-900">Complete your profile</h2>
            <p className="text-sm text-stone-500 mt-1">Your manager uses this to reach you about shifts.</p>
          </div>
          <form onSubmit={handleProfile} className="space-y-4">
            <div>
              <label htmlFor="pname" className="block text-sm font-medium text-stone-700 mb-1">
                Full name <span className="text-red-400">*</span>
              </label>
              <input
                id="pname"
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Jonas Petraitis"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label htmlFor="pphone" className="block text-sm font-medium text-stone-700 mb-1">
                Phone number <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <input
                id="pphone"
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                placeholder="e.g. +370 600 00000"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-xs text-stone-400 mt-1">Shown to your manager in the schedule.</p>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-stone-800 px-6 py-3 text-white font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Save and continue →"}
            </button>
          </form>
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
            <div>
              <p className="text-xs text-stone-400 mb-1">Step 1 of 2</p>
              <h2 className="text-xl font-bold text-stone-900">Create a company</h2>
            </div>
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
              {loading ? "Creating…" : "Create company →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <p className="text-xs text-stone-400 mb-1">Step 1 of 2</p>
              <h2 className="text-xl font-bold text-stone-900">Join a company</h2>
            </div>
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
              {loading ? "Joining…" : "Join company →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
