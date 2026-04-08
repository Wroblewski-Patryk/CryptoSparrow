'use client';

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { getStrategyPresetPresentation, StrategyPreset } from "../presets/strategyPresets";

type StrategyPresetPickerProps = {
  presets: StrategyPreset[];
  selectedPresetId: string | null;
  onSelect: (presetId: string) => void;
  onClear: () => void;
};

export default function StrategyPresetPicker({
  presets,
  selectedPresetId,
  onSelect,
  onClear,
}: StrategyPresetPickerProps) {
  const { locale } = useI18n();
  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            title: "Presety strategii",
            description: "MVP: presety sa tylko do odczytu i sa wersjonowane w kodzie.",
            clear: "Wyczysc preset",
          }
        : {
            title: "Strategy presets",
            description: "MVP: presets are read-only and versioned in code.",
            clear: "Clear preset",
          },
    [locale],
  );

  return (
    <div className="rounded-box border border-base-300/60 bg-base-200/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{copy.title}</h2>
          <p className="text-sm opacity-70">{copy.description}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onClear}
          disabled={!selectedPresetId}
        >
          {copy.clear}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {presets.map((preset) => {
          const presentation = getStrategyPresetPresentation(preset, locale);
          const isActive = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={`card border text-left transition ${
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-base-300 bg-base-100 hover:border-primary/50"
              }`}
              onClick={() => onSelect(preset.id)}
            >
              <div className="card-body p-4">
                <p className="text-sm font-semibold">{presentation.name}</p>
                <p className="text-xs opacity-70">{presentation.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {presentation.tags.map((tag) => (
                    <span key={`${preset.id}-${tag}`} className="badge badge-outline badge-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
