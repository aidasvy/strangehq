export type Locale = "en" | "lt";

const en = {
  dateLocale: "en-GB",
  nav: {
    employee: "Employee",
    admin: "Admin",
    home: "Home",
    hours: "Hours",
    schedule: "Schedule",
    availability: "Availability",
    holidays: "Holidays",
    leaveTab: "Leave",
    signOut: "Sign out",
  },
  dash: {
    shiftActive: "Shift in progress",
    since: "Since",
    tapToEnd: "tap to end",
    shiftIdle: "Shift not started",
    today: "Today",
    noShiftsToday: "No shifts today",
    start: "Start →",
    pendingEntries: (n: number) => `${n} entries awaiting approval`,
    pendingHolidays: (n: number) => `${n} holiday requests pending`,
    view: "View →",
    thisWeek: "This week",
    approvedHours: "approved hours",
    nextShift: "Next shift",
    notAssigned: "Not assigned",
    upcomingShifts: "Upcoming shifts",
    fullSchedule: "Full schedule →",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
  },
};

const lt: typeof en = {
  dateLocale: "lt-LT",
  nav: {
    employee: "Darbuotojas",
    admin: "Admin",
    home: "Pradžia",
    hours: "Valandos",
    schedule: "Grafikas",
    availability: "Prieinamumas",
    holidays: "Atostogos",
    leaveTab: "Palikti",
    signOut: "Atsijungti",
  },
  dash: {
    shiftActive: "Pamaina vyksta",
    since: "Nuo",
    tapToEnd: "palieskite, kad baigtumėte",
    shiftIdle: "Nepradėta pamaina",
    today: "Šiandien",
    noShiftsToday: "Šiandien pamainų nėra",
    start: "Pradėti →",
    pendingEntries: (n: number) => `${n} įrašai laukiantys patvirtinimo`,
    pendingHolidays: (n: number) => `laukiantys atostogų prašymai: ${n}`,
    view: "Žiūrėti →",
    thisWeek: "Ši savaitė",
    approvedHours: "patvirtintos valandos",
    nextShift: "Kita pamaina",
    notAssigned: "Nepaskirta",
    upcomingShifts: "Artėjančios pamainos",
    fullSchedule: "Visas grafikas →",
    greetingMorning: "Labas rytas",
    greetingAfternoon: "Laba diena",
    greetingEvening: "Labas vakaras",
  },
};

export type Translations = typeof en;

const dict: Record<Locale, Translations> = { en, lt };

export function getTranslations(locale: string): Translations {
  return dict[(locale as Locale) in dict ? (locale as Locale) : "lt"];
}
