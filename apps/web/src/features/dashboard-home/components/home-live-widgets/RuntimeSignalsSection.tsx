import type { ReactNode, RefObject } from "react";
import { LuActivity, LuCoins, LuSignal } from "react-icons/lu";
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
  marketsLabel: string;
  signalsLabel: string;
  baseCurrencyLabel: string;
  marketsCount: number;
  actionableSignalsCount: number;
  baseCurrencyCode: string | null;
  renderBaseCurrency?: (currency: string) => ReactNode;
  renderSymbolLabel?: (symbol: string) => ReactNode;
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
      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full justify-center md:w-auto md:justify-start">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] leading-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      </div>
      {props.hasSignalOverflow ? (
        <div className="flex justify-center md:justify-end">
          <InlinePager
            size="xs"
            hideLabelsOnMobile
            previousLabel={props.previousLabel}
            nextLabel={props.nextLabel}
            onPrevious={props.onScrollPrevious}
            onNext={props.onScrollNext}
          />
        </div>
      ) : null}
      </div>
      <div ref={props.signalRailRef} className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-full gap-3 pr-1">
          {props.signalSymbols.length === 0 ? (
            <div className="w-full rounded-box bg-base-200/35 p-4 text-center text-xs opacity-70">
              {props.noSignalDataLabel}
            </div>
          ) : null}
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
                className="w-[calc((100%_-_0.75rem_-_1px)/2)] shrink-0 rounded-box border-b-[3px] border-secondary/70 bg-base-100 bg-gradient-to-br from-primary/70 to-secondary/70 p-px md:w-[calc((100%_-_1rem_-_1px)/3)] xl:w-[calc((100%_-_1.5rem_-_1px)/4)]"
              >
                <div className="rounded-box bg-base-100/85 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <p className="min-w-0 font-semibold tracking-wide">
                      {props.renderSymbolLabel ? props.renderSymbolLabel(signal.symbol) : signal.symbol}
                    </p>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-[11px] leading-4">
                    <div
                      className={`space-y-1.5 rounded-box transition-opacity duration-150 ${
                        longActive ? "opacity-100" : "opacity-50 hover:opacity-100"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-1">
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
                          <div key={`${signal.id}-long-${index}`} className="space-y-1 font-mono text-[10px] leading-4">
                            <p className="opacity-75">{line.left}</p>
                            <p className="font-semibold">
                              <span>{line.value}</span>
                              <span className="mx-1">{line.operator}</span>
                              <span>{line.right}</span>
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <div
                      className={`space-y-1.5 rounded-box transition-opacity duration-150 ${
                        shortActive ? "opacity-100" : "opacity-50 hover:opacity-100"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-1">
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
                          <div key={`${signal.id}-short-${index}`} className="space-y-1 font-mono text-[10px] leading-4">
                            <p className="opacity-75">{line.left}</p>
                            <p className="font-semibold">
                              <span>{line.value}</span>
                              <span className="mx-1">{line.operator}</span>
                              <span>{line.right}</span>
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
