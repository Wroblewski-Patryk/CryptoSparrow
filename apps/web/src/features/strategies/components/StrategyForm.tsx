'use client';

import { useEffect, useMemo, useState } from "react";
import { LuCog, LuDoorClosed, LuDoorOpen, LuPencilLine } from "react-icons/lu";
import { useI18n } from "@/i18n/I18nProvider";
import Tabs from "@/ui/components/Tabs";
import { TAB_CONTENT_FRAME_CLASS, TAB_CONTENT_INNER_CLASS } from "@/ui/components/tabContentFrame";
import { useStrategyForm } from "../hooks/useStrategyForm";
import { StrategyFormProps } from "../types/StrategyForm.type";
import { Additional } from "./StrategyFormSections/Additional";
import { Basic } from "./StrategyFormSections/Basic";
import { Close } from "./StrategyFormSections/Close";
import { Open } from "./StrategyFormSections/Open";

type StrategyFormStep = "basic" | "open" | "close" | "additional";

export default function StrategyForm({ initial, onSubmit, formId = "strategy-form" }: StrategyFormProps) {
  const { locale } = useI18n();
  const [currentStep, setCurrentStep] = useState<StrategyFormStep>("basic");
  const { form, setForm, setBasic, setOpenConditions, setCloseConditions, setAdditional } = useStrategyForm();

  useEffect(() => {
    if (initial) setForm((prev) => ({ ...prev, ...initial }));
  }, [initial, setForm]);

  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            steps: {
              basic: "Podstawowe informacje",
              open: "Warunki otwarcia",
              close: "Warunki zamkniecia",
              additional: "Dodatkowe ustawienia",
            },
          }
        : {
            steps: {
              basic: "Basic information",
              open: "Entry conditions",
              close: "Exit conditions",
              additional: "Additional settings",
            },
          },
    [locale],
  );

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
    </form>
  );
}
