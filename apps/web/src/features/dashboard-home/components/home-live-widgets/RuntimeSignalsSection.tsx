import type { ReactNode, RefObject } from "react";
import { LuActivity, LuCoins, LuListChecks, LuSignal } from "react-icons/lu";
import InlinePager from "../../../../ui/components/InlinePager";
import type { RuntimeSymbolWithLive, SignalPillValue } from "./types";

type RuntimeSignalsSectionProps = {
  signalSymbols: RuntimeSymbolWithLive[];
  hasSignalOverflow: boolean;
  signalRailRef: RefObject<HTMLDivElement | null>;
  onScrollPrevious: () => void;
  onScrollNext: () => void;
  previousLabel: string;
  nextLabel: string;
  longLabel: string;
  shortLabel: string;
  noSignalDataLabel: string;
  titleLabel: string;
  marketsLabel: string;
  signalsLabel: string;
  baseCurrencyLabel: string;
  marketsCount: number;
  actionableSignalsCount: number;
  baseCurrencyCode: string | null;
  renderBaseCurrency?: (currency: string) => ReactNode;
  renderSymbolLabel?: (symbol: string) => ReactNode;
  renderSignalPill: (value: SignalPillValue) => ReactNode;
};

const SignalScopeIcon = ({ scope }: { scope: "LONG" | "SHORT" }) =>
  scope === "LONG" ? (
    <svg
      stroke="currentColor"
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M7 17V9" />
      <path d="m3 13 4-4 4 4" />
      <path d="M14 17h7" />
    </svg>
  ) : (
    <svg
      stroke="currentColor"
      fill="none"
      strokeWidth="2"
      viewBox="0 0 24 24"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M7 7v8" />
      <path d="m3 11 4 4 4-4" />
      <path d="M14 7h7" />
    </svg>
  );

const scopeLabelClass = (scope: "LONG" | "SHORT") =>
  scope === "LONG"
    ? "border-success/40 bg-success/10 text-success"
    : "border-error/40 bg-error/10 text-error";

export default function RuntimeSignalsSection(props: RuntimeSignalsSectionProps) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] leading-4">
          <span className="inline-flex items-center gap-1.5 font-semibold tracking-wide">
            <LuListChecks className="h-3.5 w-3.5" aria-hidden />
            {props.titleLabel}
          </span>
          <span className="opacity-40">|</span>
          <span className="inline-flex items-center gap-1.5">
            <LuCoins className="h-3.5 w-3.5 opacity-70" aria-hidden />
            <span className="opacity-70">{props.marketsLabel}:</span>
            <span className="font-semibold">{props.marketsCount}</span>
          </span>
          <span className="opacity-40">|</span>
          <span className="inline-flex items-center gap-1.5">
            <LuSignal className="h-3.5 w-3.5 opacity-70" aria-hidden />
            <span className="opacity-70">{props.signalsLabel}:</span>
            <span className="font-semibold">{props.actionableSignalsCount}</span>
          </span>
          <span className="opacity-40">|</span>
          <span className="inline-flex items-center gap-1.5">
            <LuActivity className="h-3.5 w-3.5 opacity-70" aria-hidden />
            <span className="opacity-70">{props.baseCurrencyLabel}:</span>
            {props.baseCurrencyCode ? (
              props.renderBaseCurrency ? (
                props.renderBaseCurrency(props.baseCurrencyCode)
              ) : (
                <span className="font-semibold">{props.baseCurrencyCode}</span>
              )
            ) : (
              <span className="font-semibold opacity-60">-</span>
            )}
          </span>
        </div>
        {props.hasSignalOverflow ? (
          <InlinePager
            size="xs"
            hideLabelsOnMobile
            previousLabel={props.previousLabel}
            nextLabel={props.nextLabel}
            onPrevious={props.onScrollPrevious}
            onNext={props.onScrollNext}
          />
        ) : null}
      </div>
      <div ref={props.signalRailRef} className="overflow-x-auto pb-1">
        <div className="grid grid-flow-col auto-cols-[calc((100%-0.75rem)/2)] gap-3 md:auto-cols-[calc((100%-1rem)/3)] xl:auto-cols-[calc((100%-1.5rem)/4)]">
          {props.signalSymbols.map((signal) => {
            const signalDirection: SignalPillValue = signal.lastSignalDirection ?? "NEUTRAL";
            const lines = signal.lastSignalConditionLines ?? [];
            const longLines = lines.filter((line) => line.scope === "LONG");
            const shortLines = lines.filter((line) => line.scope === "SHORT");
            const longActive = signalDirection === "LONG";
            const shortActive = signalDirection === "SHORT";

            return (
              <article
                key={signal.id}
                className="rounded-box bg-gradient-to-r from-primary/60 via-secondary/45 to-primary/60 p-px"
              >
                <div className="rounded-box bg-base-200/35 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 font-semibold tracking-wide">
                      {props.renderSymbolLabel ? props.renderSymbolLabel(signal.symbol) : signal.symbol}
                    </p>
                    {props.renderSignalPill(signalDirection)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] leading-4">
                    <div
                      className={`space-y-1 rounded-box bg-base-100/70 px-2 py-1.5 transition-opacity duration-150 ${
                        longActive ? "opacity-100" : "opacity-50 hover:opacity-100"
                      }`}
                    >
                      <div className="mb-0.5 flex items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${scopeLabelClass("LONG")}`}
                        >
                          <SignalScopeIcon scope="LONG" />
                          {props.longLabel}
                        </span>
                      </div>
                      {longLines.length === 0 ? (
                        <p className="text-[10px] opacity-55">-</p>
                      ) : (
                        longLines.map((line, index) => (
                          <p key={`${signal.id}-long-${index}`} className="font-mono text-[10px]">
                            <span>{line.left}</span>
                            <span className="mx-1">=</span>
                            <span className="font-semibold">{line.value}</span>
                            <span className="mx-1">{line.operator}</span>
                            <span>{line.right}</span>
                          </p>
                        ))
                      )}
                    </div>
                    <div
                      className={`space-y-1 rounded-box bg-base-100/70 px-2 py-1.5 transition-opacity duration-150 ${
                        shortActive ? "opacity-100" : "opacity-50 hover:opacity-100"
                      }`}
                    >
                      <div className="mb-0.5 flex items-center gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${scopeLabelClass("SHORT")}`}
                        >
                          <SignalScopeIcon scope="SHORT" />
                          {props.shortLabel}
                        </span>
                      </div>
                      {shortLines.length === 0 ? (
                        <p className="text-[10px] opacity-55">-</p>
                      ) : (
                        shortLines.map((line, index) => (
                          <p key={`${signal.id}-short-${index}`} className="font-mono text-[10px]">
                            <span>{line.left}</span>
                            <span className="mx-1">=</span>
                            <span className="font-semibold">{line.value}</span>
                            <span className="mx-1">{line.operator}</span>
                            <span>{line.right}</span>
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {props.signalSymbols.length === 0 ? (
            <div className="col-span-full rounded-box bg-base-200/35 p-4 text-center text-xs opacity-70">
              {props.noSignalDataLabel}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
