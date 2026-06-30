"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Location {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/admin/locations");
    if (res.ok) {
      setLocations(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    });
    if (res.ok) {
      setName("");
      setAddress("");
      setShowForm(false);
      load();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create");
    }
    setCreating(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this location? This cannot be undone.")) return;
    const res = await fetch("/api/admin/locations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to delete");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Link href="/admin" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">← Overview</Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Locations</h1>
          <p className="text-sm text-stone-500">Manage your venues and per-location staffing requirements</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
        >
          + Add location
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 space-y-4 max-w-md">
          <h2 className="font-semibold text-stone-900">New location</h2>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Main Branch, Gedimino Ave"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Address (optional)</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Gedimino pr. 1, Vilnius"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(""); }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-stone-400 text-sm">Loading…</p>
      ) : locations.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-8 text-center">
          <p className="text-stone-400 text-sm">No locations yet. Add your first venue above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div key={loc.id} className="rounded-lg border border-stone-200 bg-white shadow-sm p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-stone-900">{loc.name}</p>
                {loc.address && <p className="text-sm text-stone-500 mt-0.5">{loc.address}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/admin/locations/${loc.id}/staffing`}
                  className="rounded-md px-3 py-1.5 text-xs font-medium border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Staffing rules
                </Link>
                {locations.length > 1 && (
                  <button
                    onClick={() => remove(loc.id)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
