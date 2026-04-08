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
      .find((select) => within(select).queryByRole("option", { name: "Cross above" }));

    expect(conditionSelect).toBeDefined();
    expect(within(conditionSelect!).getByRole("option", { name: "Greater or equal (>=)" })).toBeInTheDocument();
    expect(within(conditionSelect!).getByRole("option", { name: "Cross below" })).toBeInTheDocument();
    expect(within(conditionSelect!).getByRole("option", { name: "In range" })).toBeInTheDocument();
    expect(within(conditionSelect!).getByRole("option", { name: "Out of range" })).toBeInTheDocument();

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

      expect(screen.getByRole("option", { name: "Momentum" })).toBeInTheDocument();
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

      expect(screen.getByRole("option", { name: "Momentum" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Formacje swiecowe" })).toBeInTheDocument();
    } finally {
      document.documentElement.lang = previousLang;
    }
  });

  it("renders human-friendly indicator and parameter labels", () => {
    const previousLang = document.documentElement.lang;
    const setValue = vi.fn();
    try {
      document.documentElement.lang = "en";
      render(
        <Indicators
          side="LONG"
          indicators={indicators}
          value={[{ ...value[0] }]}
          setValue={setValue}
        />
      );

      expect(screen.getAllByText("RSI(Relative Strength Index)").length).toBeGreaterThan(0);
      expect(screen.getByText("Period")).toBeInTheDocument();
    } finally {
      document.documentElement.lang = previousLang;
    }
  });

  it("supports band values for IN_RANGE and OUT_OF_RANGE", () => {
    const setValue = vi.fn();
    const rangeValue: UserIndicator[] = [
      {
        ...value[0],
        condition: "IN_RANGE",
        value: [45, 55],
      },
    ];

    render(<Indicators side="LONG" indicators={indicators} value={rangeValue} setValue={setValue} />);

    const fromLabel = screen.getByText("Wartosc od");
    const toLabel = screen.getByText("Wartosc do");
    expect(fromLabel).toBeInTheDocument();
    expect(toLabel).toBeInTheDocument();
    const fromInput = fromLabel.closest("div")?.querySelector("input");
    expect(fromInput).toBeTruthy();
    fireEvent.change(fromInput!, { target: { value: "46" } });

    expect(setValue).toHaveBeenCalledWith([
      expect.objectContaining({
        condition: "IN_RANGE",
        value: [46, 55],
      }),
    ]);
  });

  it("expands condition/value section when indicator has no params", () => {
    const setValue = vi.fn();
    const noParamIndicators: IndicatorMeta[] = [
      {
        name: "BULLISH_ENGULFING",
        group: "Formacje swiecowe",
        type: "pattern",
        params: [],
      },
    ];
    const noParamValue: UserIndicator[] = [
      {
        group: "Formacje swiecowe",
        name: "BULLISH_ENGULFING",
        params: {},
        condition: ">",
        value: 0.5,
        weight: 1,
        expanded: true,
      },
    ];

    render(<Indicators side="LONG" indicators={noParamIndicators} value={noParamValue} setValue={setValue} />);

    expect(screen.queryByText("Parametry wskaznika")).not.toBeInTheDocument();
    expect(screen.getByTestId("indicator-layout-0").className.includes("md:grid-cols-2")).toBe(false);
  });

  it("limits pattern indicators to comparator conditions", () => {
    const setValue = vi.fn();
    const patternIndicators: IndicatorMeta[] = [
      {
        name: "HAMMER",
        group: "Formacje swiecowe",
        type: "pattern",
        params: [],
      },
    ];
    const patternValue: UserIndicator[] = [
      {
        group: "Formacje swiecowe",
        name: "HAMMER",
        params: {},
        condition: ">",
        value: 0.5,
        weight: 1,
        expanded: true,
      },
    ];

    render(<Indicators side="LONG" indicators={patternIndicators} value={patternValue} setValue={setValue} />);

    const conditionSelect = screen
      .getAllByRole("combobox")
      .find((select) => within(select).queryByRole("option", { name: "Greater than (>)" }));

    expect(conditionSelect).toBeDefined();
    expect(within(conditionSelect!).queryByRole("option", { name: "Cross above" })).not.toBeInTheDocument();
    expect(within(conditionSelect!).queryByRole("option", { name: "In range" })).not.toBeInTheDocument();
  });
});
