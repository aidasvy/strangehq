"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setName(d.name ?? "");
        setEmail(d.email ?? "");
        setPhone(d.phone ?? "");
        setLoading(false);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? t.profile.save);
    }
  }

  if (loading) return <div className="p-6 text-sm text-stone-400">{t.common.loading}</div>;

  return (
    <div className="p-6 space-y-6 max-w-md">
      <Link href="/dashboard" className="text-sm text-stone-400 hover:text-stone-600 transition-colors">{t.common.backHome}</Link>
      <div>
        <h1 className="font-display font-bold text-2xl uppercase tracking-wide text-black">{t.profile.title}</h1>
        <p className="text-sm text-stone-500 mt-0.5">{t.profile.subtitle}</p>
      </div>

      <form onSubmit={save} className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.profile.fullName}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            placeholder="e.g. Jonas Petraitis"
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <p className="text-xs text-stone-400 mt-1">{t.profile.nameHint}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.profile.phone}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
            placeholder="e.g. +370 600 00000"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <p className="text-xs text-stone-400 mt-1">{t.profile.phoneHint}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.profile.email}</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-400 cursor-not-allowed"
          />
          <p className="text-xs text-stone-400 mt-1">{t.profile.emailHint}</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-stone-800 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {saving ? t.profile.saving : t.profile.save}
          </button>
          {saved && <span className="text-sm text-green-600">{t.profile.saved}</span>}
        </div>
      </form>
    </div>
  );
}
