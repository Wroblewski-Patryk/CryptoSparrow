import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExchangeConnectionsView from "./ExchangeConnectionsView";

const useApiKeysMock = vi.hoisted(() => vi.fn());

vi.mock("../../profile/hooks/useApiKeys", () => ({
  useApiKeys: useApiKeysMock,
}));

vi.mock("../../profile/components/ApiKeysList", () => ({
  default: () => <div>API_KEYS_LIST_STUB</div>,
}));

describe("ExchangeConnectionsView", () => {
  it("renders summary cards for loaded keys", () => {
    useApiKeysMock.mockReturnValue({
      keys: [
        {
          id: "k1",
          label: "Binance Main",
          exchange: "BINANCE",
          apiKey: "ab********yz",
          apiSecret: "",
          createdAt: "2026-03-16T10:00:00.000Z",
          lastUsed: "2026-03-16T11:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ExchangeConnectionsView />);

    expect(screen.getByText("Exchange connections gotowe")).toBeInTheDocument();
    expect(screen.getByText("Connected Exchanges")).toBeInTheDocument();
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("API_KEYS_LIST_STUB")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    useApiKeysMock.mockReturnValue({
      keys: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<ExchangeConnectionsView />);

    expect(screen.getByText("Ladowanie polaczen exchange")).toBeInTheDocument();
  });
});

