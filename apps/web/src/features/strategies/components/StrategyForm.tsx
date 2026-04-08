'use client';

import { useEffect, useMemo, useState } from "react";
import { LuCog, LuDoorClosed, LuDoorOpen, LuPencilLine } from "react-icons/lu";
import { useI18n } from "@/i18n/I18nProvider";
import { useStrategyForm } from "../hooks/useStrategyForm";
import { StrategyFormProps } from "../types/StrategyForm.type";
import { Additional } from "./StrategyFormSections/Additional";
import { Basic } from "./StrategyFormSections/Basic";
import { Close } from "./StrategyFormSections/Close";
import { Open } from "./StrategyFormSections/Open";

export default function StrategyForm({ initial, onSubmit }: StrategyFormProps) {
  const { locale } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const { form, setForm, setBasic, setOpenConditions, setCloseConditions, setAdditional } = useStrategyForm();

  useEffect(() => {
    if (initial) setForm((prev) => ({ ...prev, ...initial }));
  }, [initial, setForm]);

  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            title: "Kreator strategii",
            save: "Zapisz strategie",
            back: "Wstecz",
            next: "Dalej",
            steps: {
              basic: "Podstawowe informacje",
              open: "Warunki otwarcia",
              close: "Warunki zamkniecia",
              additional: "Dodatkowe ustawienia",
            },
          }
        : {
            title: "Strategy builder",
            save: "Save strategy",
            back: "Back",
            next: "Next",
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
      { label: copy.steps.basic, icon: <LuPencilLine className="h-5 w-5" /> },
      { label: copy.steps.open, icon: <LuDoorOpen className="h-5 w-5" /> },
      { label: copy.steps.close, icon: <LuDoorClosed className="h-5 w-5" /> },
      { label: copy.steps.additional, icon: <LuCog className="h-5 w-5" /> },
    ],
    [copy.steps],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (onSubmit) await onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid w-full grid-cols-1 md:grid-cols-4">
        <div className="md:col-span-1">
          <h2 className="mb-4 flex items-center text-3xl">{copy.title}</h2>
          <ul className="steps steps-vertical">
            {steps.map((step, index) => (
              <li
                key={step.label}
                className={`step cursor-pointer ${index <= currentStep ? "step-primary" : ""}`}
                onClick={() => setCurrentStep(index)}
              >
                <span className="step-icon">{step.icon}</span>
                <span className="hidden md:inline">{step.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-3">
          <div className="flex gap-2">
            <h2 className="flex items-center gap-3 text-2xl">
              <span className="text-primary">{steps[currentStep]?.icon}</span>
              {steps[currentStep]?.label}
            </h2>
            <button type="submit" className="btn btn-success ml-auto">
              {copy.save}
            </button>
          </div>

          <hr className="my-8 border-t border-base-200" />

          {currentStep === 0 && <Basic data={form} setData={setBasic} />}
          {currentStep === 1 && <Open data={form.openConditions} setData={setOpenConditions} />}
          {currentStep === 2 && <Close data={form.closeConditions} setData={setCloseConditions} />}
          {currentStep === 3 && <Additional data={form.additional} setData={setAdditional} />}

          <hr className="my-8 border-t border-base-200" />

          <div className="mt-8 mb-8 flex justify-between">
            <button
              type="button"
              className="btn"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              {copy.back}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={currentStep === steps.length - 1}
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              {copy.next}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
