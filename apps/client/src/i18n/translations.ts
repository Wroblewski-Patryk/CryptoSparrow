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
    logs: {
      title: string;
      breadcrumbLogs: string;
      loading: string;
      loadErrorTitle: string;
      loadErrorDescription: string;
      retry: string;
      emptyTitle: string;
      emptyDescription: string;
      loadedTitle: string;
      loadedDescription: string;
      sourceFilterLabel: string;
      severityFilterLabel: string;
      sourceAll: string;
      severityAll: string;
      refresh: string;
      tableTime: string;
      tableSource: string;
      tableSeverity: string;
      tableAction: string;
      tableActor: string;
      tableDetails: string;
      tableTrace: string;
      actorFallback: string;
      traceButton: string;
      traceTitle: string;
      traceDescription: string;
      traceNoMetadata: string;
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
      logs: {
        title: "Audit Trail",
        breadcrumbLogs: "Logs",
        loading: "Loading audit trail",
        loadErrorTitle: "Failed to load audit trail",
        loadErrorDescription: "Could not fetch audit logs.",
        retry: "Try again",
        emptyTitle: "No audit trail events",
        emptyDescription: "No log entries for selected filters.",
        loadedTitle: "Audit trail loaded",
        loadedDescription: "Loaded {count} events.",
        sourceFilterLabel: "Source filter",
        severityFilterLabel: "Severity filter",
        sourceAll: "All sources",
        severityAll: "All severity",
        refresh: "Refresh",
        tableTime: "Time",
        tableSource: "Source",
        tableSeverity: "Severity",
        tableAction: "Action",
        tableActor: "Actor",
        tableDetails: "Details",
        tableTrace: "Trace",
        actorFallback: "-",
        traceButton: "View trace",
        traceTitle: "Decision trace",
        traceDescription: "Selected event metadata and decision context.",
        traceNoMetadata: "No metadata available for this event.",
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
      logs: {
        title: "Dziennik audytu",
        breadcrumbLogs: "Logi",
        loading: "Ladowanie dziennika audytu",
        loadErrorTitle: "Nie udalo sie zaladowac dziennika audytu",
        loadErrorDescription: "Nie udalo sie pobrac logow audytu.",
        retry: "Sprobuj ponownie",
        emptyTitle: "Brak zdarzen audytu",
        emptyDescription: "Brak wpisow logow dla wybranych filtrow.",
        loadedTitle: "Dziennik audytu zaladowany",
        loadedDescription: "Wczytano {count} zdarzen.",
        sourceFilterLabel: "Filtr zrodla",
        severityFilterLabel: "Filtr poziomu",
        sourceAll: "Wszystkie zrodla",
        severityAll: "Wszystkie poziomy",
        refresh: "Odswiez",
        tableTime: "Czas",
        tableSource: "Zrodlo",
        tableSeverity: "Poziom",
        tableAction: "Akcja",
        tableActor: "Aktor",
        tableDetails: "Szczegoly",
        tableTrace: "Trace",
        actorFallback: "-",
        traceButton: "Pokaz trace",
        traceTitle: "Decision trace",
        traceDescription: "Metadane wybranego zdarzenia i kontekst decyzji.",
        traceNoMetadata: "Brak metadanych dla tego zdarzenia.",
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
