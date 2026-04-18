'use client';

import { useI18n } from "../../../i18n/I18nProvider";
import FooterPreferencesSwitchers from "../../components/FooterPreferencesSwitchers";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-base-300/60 bg-base-200/70 py-4 text-base-content/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-3 px-4 text-center md:flex-row md:justify-between md:text-left">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} {t("public.brand.name")}. {t("public.footer.rights")}
        </p>
        <FooterPreferencesSwitchers
          className="mx-auto md:mx-0"
          tone="footer"
          summaryClassName="text-base-content/80 hover:text-base-content/80 group-open:text-base-content/80"
        />
      </div>
    </footer>
  );
}
