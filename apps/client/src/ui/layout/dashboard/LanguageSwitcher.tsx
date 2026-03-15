'use client';

import { useI18n } from "../../../i18n/I18nProvider";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="join">
      <button
        type="button"
        className={`btn btn-xs join-item ${locale === "en" ? "btn-primary" : "btn-outline"}`}
        onClick={() => setLocale("en")}
        aria-label={t("dashboard.common.english")}
      >
        EN
      </button>
      <button
        type="button"
        className={`btn btn-xs join-item ${locale === "pl" ? "btn-primary" : "btn-outline"}`}
        onClick={() => setLocale("pl")}
        aria-label={t("dashboard.common.polish")}
      >
        PL
      </button>
    </div>
  );
}

