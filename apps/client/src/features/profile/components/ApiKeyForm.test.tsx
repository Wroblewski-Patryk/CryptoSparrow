import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApiKeyForm from "./ApiKeyForm";

const testApiKeyConnectionMock = vi.hoisted(() => vi.fn());

vi.mock("../services/apiKeys.service", () => ({
  testApiKeyConnection: testApiKeyConnectionMock,
}));

describe("ApiKeyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation error when test is started without credentials", async () => {
    render(<ApiKeyForm onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Testuj polaczenie" }));

    expect(await screen.findByText("Blad")).toBeInTheDocument();
    expect(
      screen.getByText("Uzupelnij API Key i API Secret przed testem.")
    ).toBeInTheDocument();
    expect(testApiKeyConnectionMock).not.toHaveBeenCalled();
  });

  it("shows success status for successful connection test", async () => {
    testApiKeyConnectionMock.mockResolvedValueOnce({
      ok: true,
      message: "Binance connection OK",
    });

    render(<ApiKeyForm onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "test-api-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Testuj polaczenie" }));

    await waitFor(() => {
      expect(testApiKeyConnectionMock).toHaveBeenCalledWith({
        exchange: "BINANCE",
        apiKey: "test-api-key",
        apiSecret: "test-api-secret",
      });
    });

    expect(await screen.findByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Binance connection OK")).toBeInTheDocument();
  });

  it("shows error status for failed connection test", async () => {
    testApiKeyConnectionMock.mockRejectedValueOnce(new Error("Invalid API credentials"));

    render(<ApiKeyForm onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "bad-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "bad-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Testuj polaczenie" }));

    expect(await screen.findByText("Blad")).toBeInTheDocument();
    expect(
      screen.getByText("Nie udalo sie zweryfikowac polaczenia.")
    ).toBeInTheDocument();
  });

  it("blocks save when connection test has not succeeded in current session", async () => {
    const onSave = vi.fn();
    render(<ApiKeyForm onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nazwa klucza"), {
      target: { value: "Binance main" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "test-api-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(testApiKeyConnectionMock).not.toHaveBeenCalled();
  });

  it("allows save after successful test for current credentials", async () => {
    const onSave = vi.fn();
    testApiKeyConnectionMock.mockResolvedValueOnce({
      ok: true,
      message: "Binance connection OK",
    });
    render(<ApiKeyForm onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nazwa klucza"), {
      target: { value: "Binance main" },
    });
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.change(screen.getByLabelText("API Secret"), {
      target: { value: "test-api-secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Testuj polaczenie" }));
    await screen.findByText("OK");

    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(onSave).toHaveBeenCalledWith({
      label: "Binance main",
      exchange: "BINANCE",
      apiKey: "test-api-key",
      apiSecret: "test-api-secret",
    });
  });
});
