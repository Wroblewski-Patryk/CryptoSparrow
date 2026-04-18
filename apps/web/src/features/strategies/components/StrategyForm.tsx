'use client';

import { useEffect, useMemo, useState } from "react";
import { LuCog, LuDoorClosed, LuDoorOpen, LuPencilLine } from "react-icons/lu";
import { useI18n } from "@/i18n/I18nProvider";
import Tabs from "@/ui/components/Tabs";
import { TAB_CONTENT_FRAME_CLASS, TAB_CONTENT_INNER_CLASS } from "@/ui/components/tabContentFrame";
import { FormPageShell, FormSectionCard } from "@/ui/forms";
import { useStrategyForm } from "../hooks/useStrategyForm";
import { StrategyFormProps } from "../types/StrategyForm.type";
import { Additional } from "./StrategyFormSections/Additional";
import { Basic } from "./StrategyFormSections/Basic";
import { Close } from "./StrategyFormSections/Close";
import { Open } from "./StrategyFormSections/Open";

type StrategyFormStep = "basic" | "open" | "close" | "additional";

export default function StrategyForm({ initial, onSubmit, formId = "strategy-form" }: StrategyFormProps) {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState<StrategyFormStep>("basic");
  const { form, setForm, setBasic, setOpenConditions, setCloseConditions, setAdditional } = useStrategyForm();

  useEffect(() => {
    if (initial) setForm((prev) => ({ ...prev, ...initial }));
  }, [initial, setForm]);

  const copy = useMemo(() => ({
    title: t("dashboard.strategies.form.title"),
    subtitle: t("dashboard.strategies.form.subtitle"),
    sections: {
      config: t("dashboard.strategies.form.sections.config"),
    },
    steps: {
      basic: t("dashboard.strategies.form.steps.basic"),
      open: t("dashboard.strategies.form.steps.open"),
      close: t("dashboard.strategies.form.steps.close"),
      additional: t("dashboard.strategies.form.steps.additional"),
    },
  }), [t]);

  const steps = useMemo(
    () => [
      { key: "basic" as const, label: copy.steps.basic, icon: <LuPencilLine className="h-4 w-4" aria-hidden /> },
      { key: "open" as const, label: copy.steps.open, icon: <LuDoorOpen className="h-4 w-4" aria-hidden /> },
      { key: "close" as const, label: copy.steps.close, icon: <LuDoorClosed className="h-4 w-4" aria-hidden /> },
      { key: "additional" as const, label: copy.steps.additional, icon: <LuCog className="h-4 w-4" aria-hidden /> },
    ],
    [copy.steps],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (onSubmit) await onSubmit(form);
  };

  return (
    <form id={formId} onSubmit={handleSubmit}>
      <FormPageShell title={copy.title} description={copy.subtitle}>
        <FormSectionCard title={copy.sections.config}>
          <div className="w-full">
            <Tabs
              items={steps}
              value={currentStep}
              onChange={(value) => setCurrentStep(value as StrategyFormStep)}
              variant="border"
              className="overflow-x-auto whitespace-nowrap"
              tabClassName="shrink-0"
              syncWithHash
            />

            <section className={TAB_CONTENT_FRAME_CLASS}>
              <div className={`${TAB_CONTENT_INNER_CLASS} p-4 sm:p-5`}>
                {currentStep === "basic" && <Basic data={form} setData={setBasic} />}
                {currentStep === "open" && <Open data={form.openConditions} setData={setOpenConditions} />}
                {currentStep === "close" && <Close data={form.closeConditions} setData={setCloseConditions} />}
                {currentStep === "additional" && <Additional data={form.additional} setData={setAdditional} />}
              </div>
            </section>
          </div>
        </FormSectionCard>
      </FormPageShell>
    </form>
  );
}
