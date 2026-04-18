import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Indicators from "./Indicators";
import type { IndicatorMeta, UserIndicator } from "../../types/StrategyForm.type";

let mockLocale: "en" | "pl" | "pt" = "en";
const indicatorCopyByLocale = {
  en: {
    "dashboard.strategies.form.indicators.collapse": "Collapse",
    "dashboard.strategies.form.indicators.expand": "Expand",
    "dashboard.strategies.form.indicators.moveUp": "Move up",
    "dashboard.strategies.form.indicators.moveDown": "Move down",
    "dashboard.strategies.form.indicators.removeIndicator": "Remove indicator",
    "dashboard.strategies.form.indicators.group": "Group",
    "dashboard.strategies.form.indicators.indicator": "Indicator",
    "dashboard.strategies.form.indicators.indicatorParams": "Indicator parameters",
    "dashboard.strategies.form.indicators.condition": "Condition",
    "dashboard.strategies.form.indicators.value": "Value",
    "dashboard.strategies.form.indicators.valueFrom": "Value from",
    "dashboard.strategies.form.indicators.valueTo": "Value to",
    "dashboard.strategies.form.indicators.weight": "Weight",
    "dashboard.strategies.form.indicators.addIndicator": "+ Add indicator",
    "dashboard.strategies.form.indicators.sideLong": "Long",
    "dashboard.strategies.form.indicators.sideShort": "Short",
  },
  pl: {
    "dashboard.strategies.form.indicators.collapse": "Zwin",
    "dashboard.strategies.form.indicators.expand": "Rozwin",
    "dashboard.strategies.form.indicators.moveUp": "Wyzej",
    "dashboard.strategies.form.indicators.moveDown": "Nizej",
    "dashboard.strategies.form.indicators.removeIndicator": "Usun wskaznik",
    "dashboard.strategies.form.indicators.group": "Grupa",
    "dashboard.strategies.form.indicators.indicator": "Wskaznik",
    "dashboard.strategies.form.indicators.indicatorParams": "Parametry wskaznika",
    "dashboard.strategies.form.indicators.condition": "Warunek",
    "dashboard.strategies.form.indicators.value": "Wartosc",
    "dashboard.strategies.form.indicators.valueFrom": "Wartosc od",
    "dashboard.strategies.form.indicators.valueTo": "Wartosc do",
    "dashboard.strategies.form.indicators.weight": "Waga",
    "dashboard.strategies.form.indicators.addIndicator": "+ Dodaj wskaznik",
    "dashboard.strategies.form.indicators.sideLong": "Long",
    "dashboard.strategies.form.indicators.sideShort": "Short",
  },
  pt: {
    "dashboard.strategies.form.indicators.collapse": "Recolher",
    "dashboard.strategies.form.indicators.expand": "Expandir",
    "dashboard.strategies.form.indicators.moveUp": "Subir",
    "dashboard.strategies.form.indicators.moveDown": "Descer",
    "dashboard.strategies.form.indicators.removeIndicator": "Remover indicador",
    "dashboard.strategies.form.indicators.group": "Grupo",
    "dashboard.strategies.form.indicators.indicator": "Indicador",
    "dashboard.strategies.form.indicators.indicatorParams": "Parametros do indicador",
    "dashboard.strategies.form.indicators.condition": "Condicao",
    "dashboard.strategies.form.indicators.value": "Valor",
    "dashboard.strategies.form.indicators.valueFrom": "Valor de",
    "dashboard.strategies.form.indicators.valueTo": "Valor ate",
    "dashboard.strategies.form.indicators.weight": "Peso",
    "dashboard.strategies.form.indicators.addIndicator": "+ Adicionar indicador",
    "dashboard.strategies.form.indicators.sideLong": "Long",
    "dashboard.strategies.form.indicators.sideShort": "Short",
  },
} as const;

vi.mock("@/i18n/I18nProvider", () => ({
  useI18n: () => ({
    locale: mockLocale,
    setLocale: vi.fn(),
    t: (key: string) =>
      indicatorCopyByLocale[mockLocale][key as keyof (typeof indicatorCopyByLocale)[typeof mockLocale]] ?? key,
  }),
}));

describe("Indicators operators", () => {
  beforeEach(() => {
    mockLocale = "en";
  });

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
    expect(within(conditionSelect!).getByRole("option", { name: "Greater than or equal (>=)" })).toBeInTheDocument();
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

    mockLocale = "en";
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

    mockLocale = "pl";
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
  });

  it("renders human-friendly indicator and parameter labels", () => {
    const setValue = vi.fn();
    mockLocale = "en";
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
  });

  it("supports band values for IN_RANGE and OUT_OF_RANGE", () => {
    mockLocale = "pl";
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
    mockLocale = "pl";
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
    mockLocale = "en";
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
