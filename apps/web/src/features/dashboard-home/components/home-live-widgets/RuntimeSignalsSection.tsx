import type { ReactNode, RefObject } from "react";
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
  renderSignalPill: (value: SignalPillValue) => ReactNode;
};

export default function RuntimeSignalsSection(props: RuntimeSignalsSectionProps) {
  return (
    <div>
      {props.hasSignalOverflow ? (
        <div className="mb-2 flex items-center justify-end">
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
      <div ref={props.signalRailRef} className="overflow-x-auto pb-1">
        <div className="grid grid-flow-col auto-cols-[calc((100%-0.75rem)/2)] gap-3 md:auto-cols-[calc((100%-1rem)/3)] xl:auto-cols-[calc((100%-1.5rem)/4)]">
          {props.signalSymbols.map((signal) => {
            const signalDirection: SignalPillValue = signal.lastSignalDirection ?? "NEUTRAL";
            const lines = signal.lastSignalConditionLines ?? [];
            const longLines = lines.filter((line) => line.scope === "LONG");
            const shortLines = lines.filter((line) => line.scope === "SHORT");

            return (
              <article key={signal.id} className="rounded-box bg-base-200/35 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold tracking-wide">{signal.symbol}</p>
                  {props.renderSignalPill(signalDirection)}
                </div>
                <div className="mt-2 space-y-2 text-[11px] leading-4">
                  <div className="space-y-1 rounded-box bg-base-100/70 px-2 py-1.5">
                    <div className="mb-0.5 flex items-center gap-1">
                      <span className="inline-flex rounded-badge border border-success/40 bg-success/10 px-1 py-[1px] text-[10px] font-semibold text-success">
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
                  <div className="space-y-1 rounded-box bg-base-100/70 px-2 py-1.5">
                    <div className="mb-0.5 flex items-center gap-1">
                      <span className="inline-flex rounded-badge border border-error/40 bg-error/10 px-1 py-[1px] text-[10px] font-semibold text-error">
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
