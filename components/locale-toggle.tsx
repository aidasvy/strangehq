"use client";

import { useLocale } from "@/lib/i18n/context";

export function LocaleToggle() {
  const { locale } = useLocale();

  function toggle() {
    const next = locale === "lt" ? "en" : "lt";
    document.cookie = `locale=${next};path=/;max-age=31536000;SameSite=Lax`;
    window.location.reload();
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-0.5 rounded-md border border-stone-200 px-1.5 py-0.5 text-[11px] font-semibold text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-colors"
      title="Switch language"
    >
      <span className={locale === "en" ? "text-stone-900" : "text-stone-400"}>EN</span>
      <span className="text-stone-300 mx-0.5">|</span>
      <span className={locale === "lt" ? "text-stone-900" : "text-stone-400"}>LT</span>
    </button>
  );
}
