'use client';

import { useI18n } from "../../../i18n/I18nProvider";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-secondary text-center text-sm py-6">
      &copy; {new Date().getFullYear()} CryptoSparrow. {t("footer.rights")}
    </footer>
  );
}
