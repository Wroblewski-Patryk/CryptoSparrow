import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LiveMarketBar from "./LiveMarketBar";

type Handler = (event: { data: string }) => void;

class EventSourceMock {
  static instances: EventSourceMock[] = [];
  private handlers = new Map<string, Handler>();
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public readonly url: string) {
    EventSourceMock.instances.push(this);
  }

  addEventListener(type: string, listener: Handler) {
    this.handlers.set(type, listener);
  }

  emit(type: string, payload: unknown) {
    const handler = this.handlers.get(type);
    if (handler) {
      handler({ data: JSON.stringify(payload) });
    }
  }
}

afterEach(() => {
  EventSourceMock.instances = [];
  vi.unstubAllGlobals();
});

describe("LiveMarketBar", () => {
  it("renders disconnected state when EventSource is unavailable", () => {
    render(<LiveMarketBar symbols={["BTCUSDT"]} interval="1m" />);

    expect(screen.getByText("Live Market Bar")).toBeInTheDocument();
    expect(screen.getByText(/stream disconnected/i)).toBeInTheDocument();
  });

  it("updates ticker/candle values from SSE events", async () => {
    vi.stubGlobal("EventSource", EventSourceMock as unknown as typeof EventSource);

    render(<LiveMarketBar symbols={["BTCUSDT"]} interval="1m" />);

    const source = EventSourceMock.instances[0];
    expect(source.url).toContain("/dashboard/market-stream/events");

    act(() => {
      source.emit("health", { connected: true, lagMs: 120 });
      source.emit("ticker", {
        symbol: "BTCUSDT",
        lastPrice: 43210.5,
        priceChangePercent24h: 2.45,
        eventTime: 1700000000000,
      });
      source.emit("candle", {
        symbol: "BTCUSDT",
        closeTime: Date.now(),
        isFinal: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/stream connected \(120ms lag\)/i)).toBeInTheDocument();
      expect(screen.getByText(/43 210,5|43,210.5|43 210.5/i)).toBeInTheDocument();
      expect(screen.getByText(/24h: \+2.45%/i)).toBeInTheDocument();
      expect(screen.getByText(/candle fresh/i)).toBeInTheDocument();
    });
  });
});
