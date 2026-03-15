import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StrategyPresetPicker from "./StrategyPresetPicker";
import { strategyPresets } from "../presets/strategyPresets";

describe("StrategyPresetPicker", () => {
  it("calls onSelect when user picks preset", () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();

    render(
      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId={null}
        onSelect={onSelect}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Trend Follow \(RSI\)/i }));
    expect(onSelect).toHaveBeenCalledWith("trend-rsi");
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
      />
    );

    expect(screen.getByRole("button", { name: "Wyczyść preset" })).toBeDisabled();

    rerender(
      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId="breakout-candle"
        onSelect={onSelect}
        onClear={onClear}
      />
    );

    const clearButton = screen.getByRole("button", { name: "Wyczyść preset" });
    expect(clearButton).not.toBeDisabled();
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

