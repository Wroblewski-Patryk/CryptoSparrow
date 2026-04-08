import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Indicators from "./Indicators";
import type { IndicatorMeta, UserIndicator } from "../../types/StrategyForm.type";

describe("Indicators operators", () => {
  const indicators: IndicatorMeta[] = [
    {
      name: "RSI",
      group: "Analiza techniczna",
      type: "oscillator",
      params: [{ name: "period", default: 14, min: 2, max: 255 }],
    },
  ];

  const value: UserIndicator[] = [
    {
      group: "Analiza techniczna",
      name: "RSI",
      params: { period: 14 },
      condition: ">",
      value: 50,
      weight: 1,
      expanded: true,
    },
  ];

  it("exposes full operator set and updates condition", () => {
    const setValue = vi.fn();
    render(
      <Indicators
        side="LONG"
        indicators={indicators}
        value={value}
        setValue={setValue}
      />
    );

    const conditionSelect = screen
      .getAllByRole("combobox")
      .find((select) => within(select).queryByRole("option", { name: "CROSS_ABOVE" }));

    expect(conditionSelect).toBeDefined();
    expect(within(conditionSelect!).getByRole("option", { name: ">=" })).toBeInTheDocument();
    expect(within(conditionSelect!).getByRole("option", { name: "CROSS_BELOW" })).toBeInTheDocument();
    expect(within(conditionSelect!).getByRole("option", { name: "IN_RANGE" })).toBeInTheDocument();
    expect(within(conditionSelect!).getByRole("option", { name: "OUT_OF_RANGE" })).toBeInTheDocument();

    fireEvent.change(conditionSelect!, { target: { value: "CROSS_ABOVE" } });

    expect(setValue).toHaveBeenCalledWith([
      expect.objectContaining({
        condition: "CROSS_ABOVE",
      }),
    ]);
  });

  it("renders taxonomy group labels in EN and PL", () => {
    const previousLang = document.documentElement.lang;
    const setValue = vi.fn();
    const taxonomyIndicators: IndicatorMeta[] = [
      {
        name: "RSI",
        group: "Analiza techniczna",
        type: "oscillator",
        params: [{ name: "period", default: 14, min: 2, max: 255 }],
      },
      {
        name: "BULLISH_ENGULFING",
        group: "Formacje swiecowe",
        type: "pattern",
        params: [],
      },
    ];

    try {
      document.documentElement.lang = "en";
      const { unmount } = render(
        <Indicators
          side="LONG"
          indicators={taxonomyIndicators}
          value={[{ ...value[0] }]}
          setValue={setValue}
        />
      );

      expect(screen.getByRole("option", { name: "Momentum / Oscillators" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Candle Patterns" })).toBeInTheDocument();
      unmount();

      document.documentElement.lang = "pl";
      render(
        <Indicators
          side="LONG"
          indicators={taxonomyIndicators}
          value={[{ ...value[0] }]}
          setValue={setValue}
        />
      );

      expect(screen.getByRole("option", { name: "Momentum / Oscylatory" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Formacje swiecowe" })).toBeInTheDocument();
    } finally {
      document.documentElement.lang = previousLang;
    }
  });
});
