import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StrategyPresetPicker from "./StrategyPresetPicker";
import { strategyPresets } from "../presets/strategyPresets";

let mockLocale: "en" | "pl" | "pt" = "en";

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    locale: mockLocale,
    setLocale: vi.fn(),
    t: vi.fn(),
  }),
}));

describe("StrategyPresetPicker", () => {
  beforeEach(() => {
    mockLocale = "en";
  });

  it("calls onSelect when user picks preset", () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();

    render(
      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId={null}
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Day Trend \(EMA \+ ADX\)/i }));
    expect(onSelect).toHaveBeenCalledWith("day-trend-ema-adx");
  });

  it("enables clear only when preset is active", () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(
      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId={null}
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    expect(screen.getByRole("button", { name: /Clear/i })).toBeDisabled();

    rerender(
      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId="breakout-roc-adx"
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    const clearButton = screen.getByRole("button", { name: /Clear/i });
    expect(clearButton).not.toBeDisabled();
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders localized content for polish locale", () => {
    mockLocale = "pl";
    const onSelect = vi.fn();
    const onClear = vi.fn();

    render(
      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId={null}
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    expect(screen.getByText("Presety strategii")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wyczysc preset/i })).toBeInTheDocument();
    expect(screen.getByText("Bardzo krotkoterminowy setup pod mikro cofniecia na szybkich wykresach.")).toBeInTheDocument();
  });

  it("renders all trader archetype presets", () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();

    render(
      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId={null}
        onSelect={onSelect}
        onClear={onClear}
      />,
    );

    expect(screen.getByText("Scalp (RSI + Stochastic)")).toBeInTheDocument();
    expect(screen.getByText("Day Trend (EMA + ADX)")).toBeInTheDocument();
    expect(screen.getByText("Swing (MACD + RSI)")).toBeInTheDocument();
    expect(screen.getByText("Mean Reversion (RSI + BB)")).toBeInTheDocument();
    expect(screen.getByText("Breakout (ROC + ADX)")).toBeInTheDocument();
    expect(screen.getByText("Perp Bias (Funding + OI + OB)")).toBeInTheDocument();
  });
});
