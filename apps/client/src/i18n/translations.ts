export type Locale = "en" | "pl";

type TranslationSchema = {
  dashboard: {
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
};

export const translations: Record<Locale, TranslationSchema> = {
  en: {
    dashboard: {
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
  },
  pl: {
    dashboard: {
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
  },
};

export const DEFAULT_LOCALE: Locale = "en";

type NestedTranslationKey<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedTranslationKey<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = NestedTranslationKey<TranslationSchema>;
