'use client';

import FooterPreferencesSwitchers from "../../components/FooterPreferencesSwitchers";
import { useI18n } from "../../../i18n/I18nProvider";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="bg-primary py-4 text-primary-content">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
        <p className="text-sm opacity-90">
          &copy; {new Date().getFullYear()} Soar. {t("dashboard.footer.rights")}
        </p>
        <FooterPreferencesSwitchers />
      </div>
    </footer>
  );
}
