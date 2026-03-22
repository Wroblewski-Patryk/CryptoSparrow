'use client';
import { useEffect, useState } from "react";
import { useStrategyForm } from "../hooks/useStrategyForm";
import { Basic } from "./StrategyFormSections/Basic";
import { Open } from "./StrategyFormSections/Open";
import { Close } from "./StrategyFormSections/Close";
import { Additional } from "./StrategyFormSections/Additional";
import { LuCog, LuDoorClosed, LuDoorOpen, LuPencilLine } from "react-icons/lu";
import { StrategyFormProps } from "../types/StrategyForm.type";

export default function StrategyForm({ initial, onSubmit }: StrategyFormProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const { form, setForm, setBasic, setOpenConditions, setCloseConditions, setAdditional } = useStrategyForm();

    useEffect(() => {
        if (initial) setForm(prev => ({ ...prev, ...initial }));
    }, [initial, setForm]);

    const steps = [
        { label: 'Podstawowe informacje', icon: <LuPencilLine className="w-5 h-5" /> },
        { label: 'Warunki otwarcia', icon: <LuDoorOpen className="w-5 h-5" /> },
        { label: 'Warunki zamknięcia', icon: <LuDoorClosed className="w-5 h-5" /> },
        { label: 'Dodatkowe ustawienia', icon: <LuCog className="w-5 h-5" /> },
    ];
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (onSubmit) await onSubmit(form);
    };
    return (
        <form onSubmit={handleSubmit}>
            <div className="w-full grid grid-cols-1 md:grid-cols-4">
                <div className="md:col-span-1">
                    <h2 className="text-3xl flex items-center mb-4">Kreator strategii</h2>
                    <ul className="steps steps-vertical">
                        {steps.map((step, i) => (
                            <li
                                key={step.label}
                                className={`step cursor-pointer ${i <= currentStep ? "step-primary" : ""}`}
                                onClick={() => setCurrentStep(i)}
                            >
                                <span className="step-icon">{step.icon}</span>
                                <span className="hidden md:inline">{step.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="md:col-span-3">
                    <div className="flex gap-2">

                        <h2 className="text-2xl flex items-center gap-3">
                            <span className="text-primary">{steps[currentStep].icon}</span>
                            {steps[currentStep].label}
                        </h2>
                        <button
                            type="submit"
                            className="btn btn-success ml-auto"
                        >
                            Zapisz strategię
                        </button>
                    </div>

                    <hr className="my-8 border-t border-base-200" />

                    {currentStep === 0 && <Basic data={form} setData={setBasic} />}
                    {currentStep === 1 && <Open data={form.openConditions} setData={setOpenConditions} />}
                    {currentStep === 2 && <Close data={form.closeConditions} setData={setCloseConditions} />}
                    {currentStep === 3 && <Additional data={form.additional} setData={setAdditional} />}

                    <hr className="my-8 border-t border-base-200" />

                    <div className="flex justify-between mt-8 mb-8">
                        <button type="button" className="btn"
                            disabled={currentStep === 0}
                            onClick={() => setCurrentStep(currentStep - 1)}>
                            Wstecz
                        </button>
                        <button type="button" className="btn btn-primary"
                            disabled={currentStep === steps.length - 1}
                            onClick={() => setCurrentStep(currentStep + 1)}>
                            Dalej
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}
