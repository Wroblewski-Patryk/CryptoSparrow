'use client';

import { useI18n } from "../../../i18n/I18nProvider";
import FooterPreferencesSwitchers from "../../components/FooterPreferencesSwitchers";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-base-300/60 bg-base-200/70 py-4 text-base-content/80">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} Soar. {t("dashboard.footer.rights")}
        </p>
        <FooterPreferencesSwitchers
          tone="footer"
          summaryClassName="text-base-content/80 hover:text-base-content/80 group-open:text-base-content/80"
        />
      </div>
    </footer>
  );
}
