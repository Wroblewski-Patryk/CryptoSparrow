export type Locale = "en" | "pl";

type TranslationSchema = {
  nav: {
    markets: string;
    builder: string;
    strategies: string;
    backtest: string;
    reports: string;
    logs: string;
    exchanges: string;
    orders: string;
    positions: string;
    bots: string;
  };
  common: {
    dashboard: string;
    add: string;
    language: string;
    english: string;
    polish: string;
  };
  footer: {
    rights: string;
  };
};

export const translations: Record<Locale, TranslationSchema> = {
  en: {
    nav: {
      markets: "Markets",
      builder: "Builder",
      strategies: "Strategies",
      backtest: "Backtest",
      reports: "Reports",
      logs: "Logs",
      exchanges: "Exchanges",
      orders: "Orders",
      positions: "Positions",
      bots: "Bots",
    },
    common: {
      dashboard: "Dashboard",
      add: "Add",
      language: "Language",
      english: "English",
      polish: "Polish",
    },
    footer: {
      rights: "All rights reserved.",
    },
  },
  pl: {
    nav: {
      markets: "Rynki",
      builder: "Builder",
      strategies: "Strategie",
      backtest: "Backtest",
      reports: "Raporty",
      logs: "Logi",
      exchanges: "Gieldy",
      orders: "Zlecenia",
      positions: "Pozycje",
      bots: "Boty",
    },
    common: {
      dashboard: "Dashboard",
      add: "Dodaj",
      language: "Jezyk",
      english: "Angielski",
      polish: "Polski",
    },
    footer: {
      rights: "Wszelkie prawa zastrzezone.",
    },
  },
};

export const DEFAULT_LOCALE: Locale = "en";

