"use client";

import { createContext, useContext } from "react";
import { type Translations, getTranslations } from "./translations";

interface LocaleContextValue {
  locale: string;
  t: Translations;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "lt",
  t: getTranslations("lt"),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, t: getTranslations(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
