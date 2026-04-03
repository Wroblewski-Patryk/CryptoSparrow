import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExchangeConnectionsView from "./ExchangeConnectionsView";

vi.mock("../../profile/components/ApiKeysList", () => ({
  default: () => <div>API_KEYS_LIST_STUB</div>,
}));

describe("ExchangeConnectionsView", () => {
  it("renders ApiKeysList content", () => {
    render(<ExchangeConnectionsView />);

    expect(screen.getByText("API_KEYS_LIST_STUB")).toBeInTheDocument();
  });
});
