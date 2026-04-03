"use client";

import { useI18n } from "../../../i18n/I18nProvider";

export default function SubscriptionPanel() {
  const { locale } = useI18n();
  const copy =
    locale === "pl"
      ? {
          title: "Subskrypcja",
          description: "Informacje o subskrypcji uzytkownika.",
        }
      : {
          title: "Subscription",
          description: "User subscription details.",
        };

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">{copy.title}</h2>
      <p>{copy.description}</p>
    </div>
  );
}
